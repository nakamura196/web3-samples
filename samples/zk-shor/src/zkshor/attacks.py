"""古典的な破り方3種。Shor を出す前に、まずここまでを見る。

    1. nonce 使い回し   実装のバグ。計算量 O(1)。今日いちばん多い事故
    2. baby-step giant-step  正攻法。O(sqrt(q)) 時間・O(sqrt(q)) メモリ
    3. Pollard rho          同じ O(sqrt(q)) 時間だが メモリ O(1)

1 は「実装が悪い」。2 と 3 は「数学どおり」で、q を大きくすれば必ず勝てる。
Shor が違うのは、q を大きくしても勝てなくなる点にある。
"""

from __future__ import annotations

from dataclasses import dataclass
from math import isqrt

from .group import Group
from .schnorr import Transcript, extract


@dataclass
class BreakResult:
    """破れたか、何ステップ掛かったか。"""
    x: int | None
    ops: int
    method: str

    @property
    def ok(self) -> bool:
        return self.x is not None


# ---------------------------------------------------------------------------
# 1. nonce 使い回し
# ---------------------------------------------------------------------------

def nonce_reuse(grp: Group, tr1: Transcript, tr2: Transcript) -> BreakResult:
    """同じ r を2回使った transcript 2本から秘密鍵を復元する。

    Schnorr の健全性の証明 (extract) と、まったく同じ計算である。
    証明のための道具が、そのまま攻撃コードになる。

    実例: Sony PlayStation 3 (2010, ECDSA の k が定数)、
          Android の SecureRandom 事故で Bitcoin の鍵が流出 (2013)。
    """
    try:
        x = extract(grp, tr1, tr2)
    except ValueError:
        return BreakResult(None, 1, "nonce-reuse")
    return BreakResult(x, 1, "nonce-reuse")


# ---------------------------------------------------------------------------
# 2. baby-step giant-step
# ---------------------------------------------------------------------------

def bsgs(grp: Group, y: int, limit: int | None = None) -> BreakResult:
    """x = m*i + j と分解して、表引きで突き合わせる。m = ceil(sqrt(q))。

    時間もメモリも sqrt(q)。q が 256 bit なら 2^128 — 全人類のディスクを
    足しても足りない。だから今日の Schnorr は安全と言える。
    """
    m = isqrt(grp.q - 1) + 1
    if limit is not None and m > limit:
        raise MemoryError(f"bsgs needs a table of {m} entries; over limit {limit}")
    ops = 0
    table = {}
    cur = 1
    for j in range(m):  # baby steps: g^j
        table.setdefault(cur, j)
        cur = cur * grp.g % grp.p
        ops += 1
    factor = grp.inv(grp.exp(m))  # g^(-m)
    cur = y
    for i in range(m):  # giant steps: y * g^(-m*i)
        ops += 1
        if cur in table:
            return BreakResult((i * m + table[cur]) % grp.q, ops, "bsgs")
        cur = cur * factor % grp.p
    return BreakResult(None, ops, "bsgs")


# ---------------------------------------------------------------------------
# 3. Pollard rho
# ---------------------------------------------------------------------------

def pollard_rho(grp: Group, y: int, max_ops: int | None = None) -> BreakResult:
    """メモリ O(1) 版。Floyd の巡回検出で衝突を探す。

    群を3つに割って歩幅を変える、教科書どおりの分割。
    """
    q, p, g = grp.q, grp.p, grp.g

    def step(u: int, a: int, b: int) -> tuple[int, int, int]:
        r = u % 3
        if r == 0:
            return u * u % p, 2 * a % q, 2 * b % q
        if r == 1:
            return u * g % p, (a + 1) % q, b
        return u * y % p, a, (b + 1) % q

    ops = 0
    u, a, b = 1, 0, 0
    U, A, B = 1, 0, 0
    cap = max_ops if max_ops is not None else 32 * (isqrt(q) + 1)
    while ops < cap:
        u, a, b = step(u, a, b)
        U, A, B = step(*step(U, A, B))
        ops += 3
        if u == U:
            db = (b - B) % q
            if db == 0:
                # 縮退。開始点を変えれば直るが、ここでは素直に諦める
                return BreakResult(None, ops, "pollard-rho")
            x = (A - a) % q * pow(db, -1, q) % q
            if grp.exp(x) == y:
                return BreakResult(x, ops, "pollard-rho")
            return BreakResult(None, ops, "pollard-rho")
    return BreakResult(None, ops, "pollard-rho")
