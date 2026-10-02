"""「じゃあ本番サイズは？」に数字で答えるための見積り。

2つの数字を分けて出す。混同されがちだが、まったく別物である。

  A. 古典計算機で Shor を *シミュレート* する費用
     このリポジトリは第3レジスタを先に測って捨てるので 2^(2n) 振幅で済む。
     素朴に全レジスタを持つと 2^(3n)。どちらにせよ n=256 で宇宙が足りない。
     -> このリポジトリのデモが玩具サイズに留まる理由

  B. 量子計算機で Shor を *実行* する費用
     論理量子ビットは O(n)、Toffoli 数は O(n^3) 程度。
     誤り訂正を掛けた物理量子ビット数の見積りが下の参考値。
     -> 「いつ危なくなるか」の話

B の代表的な見積り (公表論文の値):

  Gidney & Ekera 2021    RSA-2048 を 8 時間 / 物理 2000 万量子ビット
  Ekera & Hastad 2017    離散対数は素因数分解より *安い* (量子ビットが少なくて済む)
  Gidney 2025            条件を緩めれば RSA-2048 は 100 万量子ビット未満でも可

2026 年時点の実機は誤り訂正付きで論理量子ビット 100 個程度の桁。
まだ遠いが、「アーカイブの時間尺度」では遠くない。
"""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass
class Estimate:
    bits: int
    sim_amplitudes: float      # log10
    sim_bytes_log10: float
    logical_qubits: int
    toffoli_log10: float

    def sim_line(self) -> str:
        if self.sim_bytes_log10 < 15:
            return f"{10**self.sim_bytes_log10 / 2**30:.3g} GiB"
        return f"10^{self.sim_bytes_log10:.0f} バイト"


def estimate(bits: int) -> Estimate:
    """位数 q が bits ビットの群に対する見積り。"""
    # このリポジトリの方式: 第3レジスタを先に測って捨てるので 2 レジスタ分
    log10_amp = 2 * bits * math.log10(2)          # q^2 = 2^(2n) 振幅
    log10_bytes = log10_amp + math.log10(16)      # complex128
    logical = 3 * bits + 10                       # 2本の指数レジスタ + 値
    toffoli = 3 * math.log10(bits) + math.log10(30)  # ~30 n^3 の桁感
    return Estimate(bits, log10_amp, log10_bytes, logical, toffoli)


UNIVERSE_ATOMS_LOG10 = 80.0


def table(sizes=(10, 16, 24, 32, 64, 128, 160, 256, 384, 521)) -> str:
    rows = [
        "| q のビット長 | 用途 | 古典シミュレーションの状態量 | 論理量子ビット |",
        "|---|---|---|---|",
    ]
    use = {
        10: "このデモ", 16: "このデモ (上限付近)", 24: "—", 32: "—", 64: "—",
        128: "—", 160: "旧 DSA / SHA-1 世代", 256: "secp256k1 / Ed25519 / XRPL",
        384: "P-384", 521: "P-521",
    }
    for n in sizes:
        e = estimate(n)
        rows.append(
            f"| {n} | {use.get(n, '—')} | {e.sim_line()} | {e.logical_qubits} |"
        )
    return "\n".join(rows)


def report(bits: int = 256) -> str:
    e = estimate(bits)
    lines = [
        f"位数 {bits} bit の群 (secp256k1 / Ed25519 と同じ大きさ) について",
        "",
        "A. 古典シミュレーション (このリポジトリの方式をそのまま拡大した場合)",
        f"   状態ベクトル   10^{e.sim_amplitudes:.0f} 振幅 (2^{2*bits})",
        f"   必要メモリ     10^{e.sim_bytes_log10:.0f} バイト",
        f"   観測可能宇宙の原子数がおよそ 10^{UNIVERSE_ATOMS_LOG10:.0f} 個",
        f"   -> 差は 10^{e.sim_bytes_log10 - UNIVERSE_ATOMS_LOG10:.0f} 倍。原理的に不可能",
        "",
        "B. 量子計算機での実行",
        f"   論理量子ビット 約 {e.logical_qubits}",
        f"   Toffoli ゲート 約 10^{e.toffoli_log10:.1f}",
        "   誤り訂正込みの物理量子ビットは公表見積りで 10^6 - 10^7 の桁",
        "",
        "C. 帰結",
        "   古典で «試しに破ってみる» ことは永遠にできない。",
        "   量子で «本当に破る» ことはハードウェア次第で、いつかできる。",
        "   この2つを混同しないこと。デモが玩具サイズなのは A の制約であって、",
        "   B の困難さを意味しない。",
    ]
    return "\n".join(lines)
