"""教科書どおりの Shor: 素因数分解版。RSA を壊すほう。

離散対数版 (shor_dlog) と機械は同じ。違いは読む周期が1次元なことと、
QFT を q ではなく 2^n で取るために連分数展開が要ること。

    1. N と互いに素な a を選ぶ
    2. f(j) = a^j mod N の周期 r を量子的に求める
    3. r が偶数かつ a^(r/2) != -1 mod N なら
       gcd(a^(r/2) - 1, N) が N の非自明な約数になる

RSA では N = p*q が公開されている。N を割れれば秘密指数 d が出る。
つまり「公開鍵しか持っていない人」が秘密鍵を作れる。
"""

from __future__ import annotations

import math
import secrets
import time
from dataclasses import dataclass, field
from fractions import Fraction

import numpy as np

from .qsim import CountingRegister


@dataclass
class FactorResult:
    factors: tuple[int, int] | None
    N: int
    a: int = 0
    r: int | None = None
    shots: int = 0
    qubits: int = 0
    seconds: float = 0.0
    log: list = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return self.factors is not None


def continued_fraction_convergents(num: int, den: int) -> list[Fraction]:
    """num/den の連分数収束列 h_i/k_i を返す。

    測定値 m は size * s/r の近くに落ちる。m/size を連分数展開すると、
    分母の小さい良い近似として r (またはその約数) が現れる。
    これが 2^n 版 Shor で «周期» を古典的に取り出す唯一の手段。

        h_i = a_i*h_(i-1) + h_(i-2),  h_(-1)=1, h_(-2)=0
        k_i = a_i*k_(i-1) + k_(i-2),  k_(-1)=0, k_(-2)=1
    """
    n, d = num, den
    h_prev, h = 0, 1
    k_prev, k = 1, 0
    convergents: list[Fraction] = []
    while d:
        a = n // d
        n, d = d, n - a * d
        h_prev, h = h, a * h + h_prev
        k_prev, k = k, a * k + k_prev
        convergents.append(Fraction(h, k))
    return convergents


def _period_from_measurement(m: int, size: int, N: int, a: int) -> int | None:
    """測定値 m ~ size * s/r から r を当てる。

    収束列の分母がそのまま r とは限らない (s と r に公約数があると
    約分されて出てくる)。その分の取りこぼしを、小さい倍数を試して拾う。
    """
    for conv in continued_fraction_convergents(m, size):
        base = conv.denominator
        if base == 0:
            continue
        for mult in range(1, N // max(base, 1) + 2):
            r = base * mult
            if 0 < r < N and pow(a, r, N) == 1:
                return r
    return None


def shor_factor(
    N: int,
    max_shots: int = 12,
    seed: int | None = None,
    verbose: bool = True,
    allow_lucky_gcd: bool = False,
) -> FactorResult:
    """allow_lucky_gcd=True にすると、gcd(a,N)>1 を引いた時点で終わる。

    それは «運が良かった古典計算» であって Shor ではないので、
    既定では引き直して量子部分を必ず通す。
    """
    t0 = time.time()
    log: list[str] = []

    def say(msg: str) -> None:
        log.append(msg)
        if verbose:
            print(msg)

    if N % 2 == 0:
        return FactorResult((2, N // 2), N, log=["N が偶数。量子計算は不要"])

    n_val = N.bit_length()
    n_count = 2 * n_val  # 精度のため 2 倍取るのが標準
    size = 1 << n_count
    if n_count > 20:
        raise ValueError(f"N={N} はシミュレータには大きすぎる (2^{n_count} 振幅)")

    say(f"[shor] N = {N} ({n_val} bit)")
    say(f"[shor] 計数レジスタ {n_count} qubit + 値レジスタ {n_val} qubit "
        f"= {n_count + n_val} 論理量子ビット")
    say(f"[shor] 状態ベクトル 2^{n_count} = {size} 振幅 ({16*size/2**20:.2f} MiB)")

    for shot in range(1, max_shots + 1):
        a = secrets.randbelow(N - 2) + 2
        gcd = math.gcd(a, N)
        if gcd > 1:
            if allow_lucky_gcd:
                say(f"[shot {shot}] a = {a} が偶然 N と因子を共有。量子計算不要")
                return FactorResult((gcd, N // gcd), N, a=a, shots=shot,
                                    qubits=n_count + n_val,
                                    seconds=time.time() - t0, log=log)
            say(f"[shot {shot}] a = {a} は N と因子を共有 (古典で解けてしまう)。引き直す")
            continue

        say(f"[shot {shot}] a = {a}; f(j) = {a}^j mod {N} の周期を探す")
        table = np.empty(size, dtype=np.int64)
        cur = 1
        for j in range(size):
            table[j] = cur
            cur = cur * a % N

        reg = CountingRegister(n_count, seed=None if seed is None else seed + shot)
        k = reg.measure_function(table)
        reg.qft()
        m = reg.measure()
        say(f"[shot {shot}] 値レジスタ測定 -> {k}; QFT 後の測定 -> m = {m}/{size}")

        r = _period_from_measurement(m, size, N, a)
        if r is None:
            say(f"[shot {shot}] 連分数展開で周期を取れず。引き直す")
            continue
        say(f"[shot {shot}] 周期 r = {r}  (検証: {a}^{r} mod {N} = {pow(a, r, N)})")

        if r % 2 == 1:
            say(f"[shot {shot}] r が奇数。使えない。引き直す")
            continue
        root = pow(a, r // 2, N)
        if root == N - 1:
            say(f"[shot {shot}] a^(r/2) = -1 mod N。自明な因子しか出ない。引き直す")
            continue
        f1, f2 = math.gcd(root - 1, N), math.gcd(root + 1, N)
        for f in (f1, f2):
            if 1 < f < N:
                say(f"[shot {shot}] N = {f} x {N // f}")
                return FactorResult((f, N // f), N, a=a, r=r, shots=shot,
                                    qubits=n_count + n_val,
                                    seconds=time.time() - t0, log=log)
        say(f"[shot {shot}] 自明な因子のみ。引き直す")

    return FactorResult(None, N, shots=max_shots, qubits=n_count + n_val,
                        seconds=time.time() - t0, log=log)


# ---------------------------------------------------------------------------
# 玩具 RSA。Shor で秘密鍵を再構成できることの確認用
# ---------------------------------------------------------------------------

@dataclass
class ToyRSA:
    n: int
    e: int
    d: int

    def encrypt(self, m: int) -> int:
        return pow(m, self.e, self.n)

    def decrypt(self, c: int) -> int:
        return pow(c, self.d, self.n)


def toy_rsa(p: int = 17, q: int = 19, e: int = 5) -> ToyRSA:
    phi = (p - 1) * (q - 1)
    return ToyRSA(p * q, e, pow(e, -1, phi))


def recover_rsa_private_key(n: int, e: int, factors: tuple[int, int]) -> int:
    """N の因数分解が分かれば、公開鍵だけから秘密指数 d が作れる。"""
    p, q = factors
    return pow(e, -1, (p - 1) * (q - 1))
