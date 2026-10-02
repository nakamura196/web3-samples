"""Schnorr 証明 — 「x を知っている」ことを x を渡さずに示す最小の実物。

対話版 (3 手)
    1. Prover: r をランダムに引き、t = g^r を送る            (commitment)
    2. Verifier: c をランダムに引いて送る                    (challenge)
    3. Prover: s = r + c*x mod q を送る                      (response)
       Verifier: g^s == t * y^c を確認する

非対話版 (Fiat-Shamir)
    c を「乱数」ではなく c = H(群, y, t, 文脈) にする。
    ハッシュはあらかじめ予測できないので、検証者が居なくても
    challenge をごまかせない。署名はこれの応用でしかない。

この3つが揃って初めて「ゼロ知識証明」と呼べる:

    完全性 (completeness)  正直な証明は必ず通る          -> prove/verify
    健全性 (soundness)     知らない人は通せない          -> extract()
    ゼロ知識 (zero-knowledge) 通った証明から x は漏れない -> simulate()

extract() と simulate() はテストのための飾りではない。この2つの関数が
書けること自体が、健全性とゼロ知識の「証明」になっている。
"""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass

from .group import Group

DOMAIN = b"zkshor/schnorr/v1"


# ---------------------------------------------------------------------------
# 鍵
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class KeyPair:
    group: Group
    x: int  # 秘密。これを守るのが全て
    y: int  # 公開。y = g^x

    def public(self) -> int:
        return self.y


def keygen(grp: Group) -> KeyPair:
    x = grp.rand_exp()
    return KeyPair(grp, x, grp.exp(x))


# ---------------------------------------------------------------------------
# Fiat-Shamir の challenge
# ---------------------------------------------------------------------------

def _lp(n: int) -> bytes:
    """長さ前置きした整数のエンコード。

    連結する値の境界を曖昧にすると、別々の主張が同じハッシュになる
    (H(a||b) の衝突)。地味だが、ここを省いた実装は実際に壊れている。
    """
    b = n.to_bytes((n.bit_length() + 7) // 8 or 1, "big")
    return len(b).to_bytes(4, "big") + b


def challenge(grp: Group, y: int, t: int, ctx: bytes = b"") -> int:
    """c = H(domain, p, q, g, y, t, ctx) mod q

    y (主張) と g,p,q (パラメータ) をハッシュに入れるのが要点。
    t だけでハッシュを取ると、証明を別の鍵の証明として使い回せる。
    """
    h = hashlib.sha256()
    h.update(DOMAIN)
    for v in (grp.p, grp.q, grp.g, y, t):
        h.update(_lp(v))
    h.update(len(ctx).to_bytes(4, "big"))
    h.update(ctx)
    return int.from_bytes(h.digest(), "big") % grp.q


# ---------------------------------------------------------------------------
# 対話版
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Transcript:
    """(t, c, s) の3つ組。対話1回分の記録。"""
    t: int
    c: int
    s: int


def commit(grp: Group, r: int | None = None) -> tuple[int, int]:
    """r を引いて t = g^r を返す。r は nonce。使い回した瞬間に鍵が死ぬ。"""
    if r is None:
        r = grp.rand_exp()
    return r, grp.exp(r)


def respond(grp: Group, x: int, r: int, c: int) -> int:
    return (r + c * x) % grp.q


def verify_transcript(grp: Group, y: int, tr: Transcript) -> bool:
    """g^s == t * y^c を確認する。y が本当に群の元かも見る。"""
    if not grp.contains(y) or not grp.contains(tr.t):
        return False
    if not (0 <= tr.c < grp.q and 0 <= tr.s < grp.q):
        return False
    return grp.exp(tr.s) == (tr.t * grp.pow(y, tr.c)) % grp.p


def interact(kp: KeyPair, c: int | None = None, r: int | None = None) -> Transcript:
    """正直な Prover と検証者の 1 ラウンドを回す。"""
    grp = kp.group
    r, t = commit(grp, r)
    if c is None:
        c = secrets.randbelow(grp.q)
    return Transcript(t, c, respond(grp, kp.x, r, c))


# ---------------------------------------------------------------------------
# 非対話版 (Fiat-Shamir)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Proof:
    """非対話証明。c は検証側で再計算するので持たない。"""
    t: int
    s: int

    def to_dict(self) -> dict:
        return {"t": str(self.t), "s": str(self.s)}


def prove(kp: KeyPair, ctx: bytes = b"") -> Proof:
    grp = kp.group
    r, t = commit(grp)
    c = challenge(grp, kp.y, t, ctx)
    return Proof(t, respond(grp, kp.x, r, c))


def verify(grp: Group, y: int, pf: Proof, ctx: bytes = b"") -> bool:
    c = challenge(grp, y, pf.t, ctx)
    return verify_transcript(grp, y, Transcript(pf.t, c, pf.s))


# ---------------------------------------------------------------------------
# 健全性: 2本の transcript から x が出る (special soundness)
# ---------------------------------------------------------------------------

def extract(grp: Group, tr1: Transcript, tr2: Transcript) -> int:
    """同じ t に対する異なる challenge 2本から x を復元する。

        s1 = r + c1*x,  s2 = r + c2*x
        => x = (s1 - s2) / (c1 - c2)  mod q

    「x を知らずに 2 本作れるなら、その人は x を計算できてしまう」
    ——これが健全性の証明。同時に、nonce r を使い回した実装への
    攻撃そのものでもある (attacks.nonce_reuse)。
    """
    if tr1.t != tr2.t:
        raise ValueError("commitments differ; extraction needs the same t")
    if tr1.c == tr2.c:
        raise ValueError("challenges are identical; nothing to extract")
    dc = (tr1.c - tr2.c) % grp.q
    ds = (tr1.s - tr2.s) % grp.q
    return ds * pow(dc, -1, grp.q) % grp.q


# ---------------------------------------------------------------------------
# ゼロ知識: x なしで本物と区別できない transcript が作れる
# ---------------------------------------------------------------------------

def simulate(grp: Group, y: int, c: int | None = None) -> Transcript:
    """秘密を持たずに、検証を通る (t, c, s) を作る。

    手順を逆にするだけ: s と c を先に引いて、t = g^s * y^(-c) と置く。
    これで g^s == t*y^c は恒等的に成り立つ。

    本物の transcript の分布とこれは *完全に一致* する。よって
    「証明を見た人が得る情報」はゼロ。これが zero-knowledge の中身。

    ではなぜこれが偽造にならないのか: c を自分で選んでいるから。
    実際の検証者 (または Fiat-Shamir のハッシュ) は c を後から指定する。
    """
    if c is None:
        c = secrets.randbelow(grp.q)
    s = secrets.randbelow(grp.q)
    t = grp.exp(s) * grp.inv(grp.pow(y, c)) % grp.p
    return Transcript(t, c, s)
