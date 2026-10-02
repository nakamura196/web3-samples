"""Shor の離散対数アルゴリズム。y = g^x から x を取り出す。

素因数分解版のほうが有名だが、ZKP や署名を壊すのはこちらである。
やっていることは1つ: 2変数関数

    f(a, b) = g^a * y^b  mod p

の *周期構造* を読む。y = g^x なので f(a,b) = g^(a + x*b)。
つまり f は「a + x*b mod q」だけで決まる。同じ値になる (a,b) の集合は
格子をなし、その格子の傾きがまさに x である。

古典計算機は「同じ値になる組」を探すのに sqrt(q) 回の試行が要る
(それが Pollard rho)。量子計算機は重ね合わせで全部同時に評価し、
QFT で傾きだけを取り出す。

    1. |a>|b>|0>  を全 (a,b) について一様に重ね合わせる
    2. 第3レジスタに f(a,b) を書く
    3. 第3レジスタを測る -> 第1・2レジスタが a + x*b = m の直線に潰れる
    4. 両レジスタに QFT_q
    5. 測ると (c, d) が出る。理論上 *必ず* d = c*x mod q
    6. x = d * c^(-1) mod q            <- 1 回の測定で秘密鍵が出る

ステップ 5 は近似ではない。q が素数で QFT を mod q で取るかぎり、
d != c*x の振幅は厳密にゼロになる。下の verbose 出力で確認できる。
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

import numpy as np

from .group import Group
from .qsim import QuditPair, state_bytes


@dataclass
class ShorDlogResult:
    x: int | None
    shots: int
    seconds: float
    c: int = 0
    d: int = 0
    qubits: int = 0          # 実機で要る量子ビットの目安
    sim_bytes: int = 0       # 古典シミュレーションで要ったメモリ
    exact: bool = False      # d == c*x が厳密に成り立っていたか
    log: list = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return self.x is not None


def function_table(grp: Group, y: int) -> np.ndarray:
    """f(a, b) = g^a * y^b mod p を全 (a,b) について並べる。

    実機ではこれはモジュラ冪乗の *可逆回路* になる (行列は作らない)。
    ここが Shor 実装のほとんどの量子ビットとゲート数を食う部分。
    """
    q = grp.q
    ga = np.array([grp.exp(a) for a in range(q)], dtype=object)
    yb = np.array([grp.pow(y, b) for b in range(q)], dtype=object)
    tbl = np.outer(ga, yb) % grp.p
    return tbl.astype(np.int64)


def shor_dlog(
    grp: Group,
    y: int,
    max_shots: int = 8,
    seed: int | None = None,
    verbose: bool = True,
) -> ShorDlogResult:
    """公開情報 (grp, y) だけを受け取り、秘密指数 x を返す。"""
    q = grp.q
    t0 = time.time()
    log: list[str] = []

    def say(msg: str) -> None:
        log.append(msg)
        if verbose:
            print(msg)

    if grp.p.bit_length() > 62:
        raise ValueError(
            "このシミュレータは p が 62 bit 以下の玩具パラメータ専用。"
            " 実サイズは estimate.py を見ること。"
        )

    say(f"[shor] 群: {grp.describe()}")
    say(f"[shor] 状態ベクトル: {q} x {q} = {q*q} 振幅 ({state_bytes(q)/2**20:.1f} MiB)")
    say(f"[shor] 実機なら約 {3 * q.bit_length()} 論理量子ビット相当")

    say("[shor] f(a,b) = g^a y^b mod p の表を構成 (実機では可逆回路)")
    table = function_table(grp, y)

    for shot in range(1, max_shots + 1):
        reg = QuditPair(q, seed=None if seed is None else seed + shot).uniform()
        k = reg.measure_function(table)
        say(f"[shot {shot}] 第3レジスタを測定 -> f = {k}; "
            f"残った基底 {reg.support()} 個 (= q なら直線1本に潰れた)")

        reg.qft_both()
        c, d = reg.measure()
        say(f"[shot {shot}] QFT 後に測定 -> (c, d) = ({c}, {d})")

        if c == 0:
            say(f"[shot {shot}] c = 0 は情報を持たない (確率 1/q)。引き直す")
            continue

        x = d * pow(c, -1, q) % q
        say(f"[shot {shot}] x = d * c^-1 mod q = {x}")

        if grp.exp(x) == y:
            # 秘密を知らなくても g^x == y で検証できる。ここが決定的
            exact = _check_exactness(reg_q=q, c=c, d=d, x=x)
            say(f"[shot {shot}] 検証: g^{x} == y  -> 成功")
            return ShorDlogResult(
                x=x, shots=shot, seconds=time.time() - t0, c=c, d=d,
                qubits=3 * q.bit_length(), sim_bytes=state_bytes(q),
                exact=exact, log=log,
            )
        say(f"[shot {shot}] 検証に失敗。引き直す")

    return ShorDlogResult(
        x=None, shots=max_shots, seconds=time.time() - t0,
        qubits=3 * q.bit_length(), sim_bytes=state_bytes(q), log=log,
    )


def _check_exactness(reg_q: int, c: int, d: int, x: int) -> bool:
    return d == c * x % reg_q


def peak_structure(grp: Group, y: int, seed: int | None = None) -> dict:
    """QFT 後の確率分布を調べ、d = c*x 以外が本当にゼロか確かめる。

    「たまたま当たった」のではなく干渉で他が消えていることの実証。
    """
    q = grp.q
    table = function_table(grp, y)
    reg = QuditPair(q, seed=seed).uniform()
    reg.measure_function(table)
    reg.qft_both()
    probs = np.abs(reg.psi) ** 2

    # 秘密 x は知らない前提だが、検証のためだけにここでは総当たりで求める
    x = next(e for e in range(q) if grp.exp(e) == y)
    on_line = sum(probs[c, c * x % q] for c in range(q))
    off_line = probs.sum() - on_line
    return {
        "x": x,
        "prob_on_line": float(on_line),
        "prob_off_line": float(off_line),
        "max_off_line": float(max(
            probs[c, d] for c in range(q) for d in range(q) if d != c * x % q
        )),
        "nonzero_cells": int(np.count_nonzero(probs > 1e-12)),
        "q": q,
    }
