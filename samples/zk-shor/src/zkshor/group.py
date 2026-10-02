"""素位数の巡回群。

Schnorr 証明も Shor の離散対数も、舞台は同じ「位数 q の巡回群 <g>」である。
ここでは Z_p^* の部分群として作る (p, q は素数、q | p-1)。楕円曲線でも
議論は変わらないが、pow() だけで書ける方が読みやすいのでこちらにした。

    p : 法となる素数        (群が住む世界の大きさ)
    q : 部分群の位数、素数  (安全性を決めるのはこちら)
    g : 位数 q の生成元

安全性の根拠は「y = g^x mod p から x を求めるのが難しい」ことだけ。
この一行が崩れると、この上に建っている全部が崩れる。
"""

from __future__ import annotations

import json
import secrets
from dataclasses import dataclass
from pathlib import Path

_SMALL_PRIMES = [
    2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67,
    71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149,
    151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229,
]


def is_probable_prime(n: int, rounds: int = 48) -> bool:
    """Miller-Rabin。標準ライブラリだけで書く。"""
    if n < 2:
        return False
    for sp in _SMALL_PRIMES:
        if n % sp == 0:
            return n == sp
    d, s = n - 1, 0
    while d % 2 == 0:
        d //= 2
        s += 1
    for _ in range(rounds):
        a = secrets.randbelow(n - 3) + 2
        v = pow(a, d, n)
        if v in (1, n - 1):
            continue
        for _ in range(s - 1):
            v = v * v % n
            if v == n - 1:
                break
        else:
            return False
    return True


def gen_prime(bits: int) -> int:
    """bits ビットの素数を1つ引く。最上位ビットを立てて桁を固定する。"""
    if bits < 3:
        raise ValueError("bits must be >= 3")
    while True:
        cand = secrets.randbits(bits) | (1 << (bits - 1)) | 1
        if is_probable_prime(cand):
            return cand


@dataclass(frozen=True)
class Group:
    """位数 q の巡回群 <g> ⊂ Z_p^*。"""

    p: int
    q: int
    g: int
    label: str = "unnamed"

    # --- 群演算 ---------------------------------------------------------
    def exp(self, e: int) -> int:
        """g^e mod p。指数は mod q で正規化する。"""
        return pow(self.g, e % self.q, self.p)

    def pow(self, h: int, e: int) -> int:
        return pow(h, e % self.q, self.p)

    def inv(self, h: int) -> int:
        return pow(h, self.p - 2, self.p)

    def contains(self, h: int) -> bool:
        """h が本当に <g> の元か。ここを省くと small-subgroup 攻撃が通る。"""
        return 1 <= h < self.p and pow(h, self.q, self.p) == 1

    def rand_exp(self) -> int:
        """[1, q-1] から一様に。0 は秘密鍵として使えないので外す。"""
        return secrets.randbelow(self.q - 1) + 1

    # --- 性質 -----------------------------------------------------------
    @property
    def bits(self) -> int:
        """安全性のビット数の目安ではなく、q の素のビット長。"""
        return self.q.bit_length()

    def validate(self) -> None:
        """受け取ったパラメータを信用しない。読み込み時に必ず通す。"""
        if not is_probable_prime(self.p):
            raise ValueError("p is not prime")
        if not is_probable_prime(self.q):
            raise ValueError("q is not prime")
        if (self.p - 1) % self.q != 0:
            raise ValueError("q does not divide p-1")
        if not (1 < self.g < self.p):
            raise ValueError("g out of range")
        if pow(self.g, self.q, self.p) != 1:
            raise ValueError("g is not of order q")
        if self.g == 1:
            raise ValueError("g is trivial")

    def describe(self) -> str:
        return (
            f"{self.label}: |q| = {self.q.bit_length()} bit, "
            f"|p| = {self.p.bit_length()} bit, q = {self.q}"
            if self.q.bit_length() <= 24
            else f"{self.label}: |q| = {self.q.bit_length()} bit, |p| = {self.p.bit_length()} bit"
        )

    # --- 保存 / 復元 ----------------------------------------------------
    def to_json(self) -> str:
        return json.dumps(
            {"label": self.label, "p": str(self.p), "q": str(self.q), "g": str(self.g)},
            indent=2,
        )

    @staticmethod
    def from_json(text: str) -> "Group":
        d = json.loads(text)
        grp = Group(int(d["p"]), int(d["q"]), int(d["g"]), d.get("label", "loaded"))
        grp.validate()
        return grp


def make_group(q_bits: int, p_bits: int, label: str = "generated") -> Group:
    """q_bits ビットの素数 q を選び、p = k*q + 1 が素数になる k を探す。

    g は h^k mod p で作る。h^k は必ず位数 q の元 (または 1) になるので、
    1 でないものを1つ拾えばよい。
    """
    if p_bits <= q_bits + 1:
        raise ValueError("p_bits must exceed q_bits")
    q = gen_prime(q_bits)
    k_bits = p_bits - q_bits
    while True:
        k = secrets.randbits(k_bits) | (1 << (k_bits - 1))
        k -= k % 2  # p = kq+1 を奇数にする (q は奇素数なので k は偶数)
        if k == 0:
            continue
        p = k * q + 1
        if p.bit_length() != p_bits or not is_probable_prime(p):
            continue
        for _ in range(64):
            h = secrets.randbelow(p - 3) + 2
            g = pow(h, k, p)
            if g != 1:
                grp = Group(p, q, g, label)
                grp.validate()
                return grp


# ---------------------------------------------------------------------------
# 用意してある2つのパラメータ
# ---------------------------------------------------------------------------

_PARAMS_DIR = Path(__file__).resolve().parents[2] / "params"


def toy(q_bits: int = 10) -> Group:
    """シミュレータで Shor が実際に回るサイズ。

    量子シミュレーションの状態ベクトルは q^2 個の複素数を持つので、
    q が 10 bit (~1000) なら 16 MB 程度で収まる。
    """
    path = _PARAMS_DIR / f"toy-{q_bits}.json"
    if path.exists():
        return Group.from_json(path.read_text())
    grp = make_group(q_bits, q_bits + 12, label=f"toy-{q_bits}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(grp.to_json())
    return grp


def real(q_bits: int = 256, p_bits: int = 2048) -> Group:
    """実運用サイズ。Schnorr は動くが、Shor はこの世で回せない。"""
    path = _PARAMS_DIR / f"real-{p_bits}-{q_bits}.json"
    if path.exists():
        return Group.from_json(path.read_text())
    grp = make_group(q_bits, p_bits, label=f"real-{p_bits}-{q_bits}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(grp.to_json())
    return grp
