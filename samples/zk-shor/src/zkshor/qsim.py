"""ごく小さな量子シミュレータ。

Shor を「それっぽく見せる」のではなく、本当に状態ベクトルを持って
干渉させる。ただし当然、古典計算機なので指数的に重い。そこが要点でもある。

2種類を用意した:

  QuditPair  Z_q x Z_q 上の状態。QFT を 2^n ではなく mod q で取る。
             離散対数版 Shor がいちばん綺麗に書ける形。
             状態は q^2 個の複素数 = 16*q^2 バイト。

  Qubits     2^n 次元の状態。教科書どおりの Shor (素因数分解) 用。
             QFT_{2^n} と連分数展開が要る。

どちらも「行列を掛ける」だけで、ゲート分解はしていない。
実機の回路量は estimate.py で別に見積もる。
"""

from __future__ import annotations

import math
import secrets
from functools import lru_cache

import numpy as np


def _rng(seed: int | None):
    return np.random.default_rng(secrets.randbits(64) if seed is None else seed)


# ---------------------------------------------------------------------------
# Z_q 上の QFT
# ---------------------------------------------------------------------------

@lru_cache(maxsize=8)
def qft_matrix(q: int) -> np.ndarray:
    """F[j,k] = omega^(jk) / sqrt(q), omega = exp(2*pi*i/q)。

    q^2 個の複素数を持つ。q=1021 で 16 MB。
    """
    j = np.arange(q)
    return np.exp(2j * np.pi * np.outer(j, j) / q) / math.sqrt(q)


def state_bytes(q: int) -> int:
    return 16 * q * q


class QuditPair:
    """2つの q 次元レジスタ。psi[a, b] が |a>|b> の振幅。"""

    def __init__(self, q: int, seed: int | None = None):
        self.q = q
        self.rng = _rng(seed)
        self.psi = np.zeros((q, q), dtype=np.complex128)

    # --- 準備 -----------------------------------------------------------
    def uniform(self) -> "QuditPair":
        """アダマール相当。すべての (a, b) を等しい重みで重ね合わせる。"""
        self.psi[:, :] = 1.0 / self.q
        return self

    # --- 第3レジスタの測定 ----------------------------------------------
    def measure_function(self, table: np.ndarray) -> int:
        """|a,b>|0> -> |a,b>|f(a,b)> と計算してから、第3レジスタを測る。

        測定結果 k はランダムに1つ選ばれ、第1・第2レジスタは
        f(a,b) == k を満たす (a,b) の重ね合わせに *潰れる*。

        ここが Shor の心臓部。この時点で状態は「f の周期構造」だけを
        持つようになり、あとは QFT がその周期を読み出す。

        注意: 秘密の値は一切使っていない。table は誰でも計算できる
        公開情報 (g^a * y^b mod p) だけから作る。
        """
        probs = np.abs(self.psi.ravel()) ** 2
        probs /= probs.sum()
        idx = self.rng.choice(probs.size, p=probs)
        k = int(table.ravel()[idx])

        mask = table == k
        self.psi = np.where(mask, self.psi, 0.0)
        self.psi /= np.linalg.norm(self.psi)
        return k

    # --- QFT -------------------------------------------------------------
    def qft_both(self, exact_matrix: bool = False) -> "QuditPair":
        """両レジスタに QFT_q。周期が「尖った山」に変換される。

        exact_matrix=True にすると定義どおりの行列積で計算する。
        FFT 版と一致することの確認用 (tests を参照)。
        """
        if exact_matrix:
            f = qft_matrix(self.q)
            self.psi = f @ self.psi @ f  # F は対称行列なので転置不要
        else:
            self.psi = qft_apply_2d(self.psi, self.q)
        return self

    # --- 最終測定 --------------------------------------------------------
    def measure(self) -> tuple[int, int]:
        probs = np.abs(self.psi.ravel()) ** 2
        probs /= probs.sum()
        idx = int(self.rng.choice(probs.size, p=probs))
        return divmod(idx, self.q)

    def support(self, tol: float = 1e-9) -> int:
        """振幅が実質ゼロでない基底の数。干渉が効いたかの確認用。"""
        return int(np.count_nonzero(np.abs(self.psi) ** 2 > tol))


# ---------------------------------------------------------------------------
# 2^n 次元 (素因数分解版 Shor 用)
# ---------------------------------------------------------------------------

def qft_apply(psi: np.ndarray) -> np.ndarray:
    """1次元 QFT。行列ではなく FFT で掛ける。

    QFT は定義どおりに書くと O(N^2) の行列積になるが、それは
    N = 2^18 で 1 TB を要求して破綻する (最初の実装がこれで落ちた)。
    FFT は同じ線形写像を O(N log N) で計算する。近似ではなく厳密。

        QFT|psi>[c] = (1/sqrt(N)) sum_a exp(+2*pi*i*c*a/N) psi[a]
        numpy.fft.ifft は (1/N) sum exp(+...) なので sqrt(N) 倍で合う
    """
    return np.fft.ifft(psi) * math.sqrt(psi.shape[-1])


def qft_apply_2d(psi: np.ndarray, q: int) -> np.ndarray:
    """両軸に QFT_q。q は 2 の冪でなくてよい (numpy が Bluestein で処理する)。"""
    return np.fft.ifft2(psi) * q


class CountingRegister:
    """n 量子ビットの計数レジスタ 1本。値レジスタは古典的に持つ。"""

    def __init__(self, n: int, seed: int | None = None):
        self.n = n
        self.size = 1 << n
        self.rng = _rng(seed)
        self.psi = np.full(self.size, 1.0 / math.sqrt(self.size), dtype=np.complex128)

    def measure_function(self, table: np.ndarray) -> int:
        probs = np.abs(self.psi) ** 2
        probs /= probs.sum()
        idx = int(self.rng.choice(self.size, p=probs))
        k = int(table[idx])
        self.psi = np.where(table == k, self.psi, 0.0)
        self.psi /= np.linalg.norm(self.psi)
        return k

    def qft(self) -> "CountingRegister":
        self.psi = qft_apply(self.psi)
        return self

    def measure(self) -> int:
        probs = np.abs(self.psi) ** 2
        probs /= probs.sum()
        return int(self.rng.choice(self.size, p=probs))
