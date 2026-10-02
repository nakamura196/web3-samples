"""台帳モデル — XRPL / Ethereum が Shor で何を失うのかを最小構成で示す。

実物の署名は XRPL なら secp256k1 か Ed25519、Ethereum なら secp256k1。
どれも「離散対数が難しい」という *同じ一行* に依存している。ここでは
その一行を共有する Schnorr 署名で代用する。壊れ方は同じである。

台帳の設計で決定的なのは次の2点:

  1. アドレスは公開鍵のハッシュ。だから鍵は「初回送金まで」は隠れている
  2. 一度送金すると、公開鍵は台帳に載り、*永久に消えない*

2 が効く。攻撃者は今日の台帳をまるごと保存しておき、量子計算機が
手に入った日に鍵を再構成すればよい。これを harvest now, forge later と呼ぶ。
アーカイブにとって嫌なのは、この「保存されているほど危ない」という
性質が、台帳の長所とまったく同じものである点である。
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field

from .group import Group
from .schnorr import KeyPair, Proof, keygen, prove, verify


def address_of(grp: Group, pubkey: int) -> str:
    """公開鍵のハッシュをアドレスにする。XRPL の r... と同じ考え方。"""
    h = hashlib.sha256(str(pubkey).encode()).digest()
    return "r" + h[:10].hex()


@dataclass(frozen=True)
class Payment:
    """送金1件。署名の対象は取引の中身そのもの。"""
    sender: str
    receiver: str
    amount: int
    sequence: int
    pubkey: int      # <- 台帳に永久に載る。ここが将来の弱点になる
    proof: Proof

    def message(self) -> bytes:
        return (
            f"{self.sender}|{self.receiver}|{self.amount}|{self.sequence}"
        ).encode()


@dataclass
class Account:
    grp: Group
    kp: KeyPair
    sequence: int = 0

    @property
    def address(self) -> str:
        return address_of(self.grp, self.kp.y)

    def pay(self, to: str, amount: int) -> Payment:
        self.sequence += 1
        # 署名 = 取引内容を文脈に入れた知識証明。中身を1文字変えると通らない
        tmp = Payment(self.address, to, amount, self.sequence, self.kp.y,
                      Proof(0, 0))
        pf = prove(self.kp, ctx=tmp.message())
        return Payment(self.address, to, amount, self.sequence, self.kp.y, pf)


@dataclass
class Ledger:
    """検証規則と、消えない履歴。"""
    grp: Group
    history: list = field(default_factory=list)
    balances: dict = field(default_factory=dict)

    def credit(self, addr: str, amount: int) -> None:
        self.balances[addr] = self.balances.get(addr, 0) + amount

    def validate(self, tx: Payment) -> tuple[bool, str]:
        if address_of(self.grp, tx.pubkey) != tx.sender:
            return False, "公開鍵とアドレスが一致しない"
        if not verify(self.grp, tx.pubkey, tx.proof, ctx=tx.message()):
            return False, "署名が不正"
        if self.balances.get(tx.sender, 0) < tx.amount:
            return False, "残高不足"
        if any(h.sender == tx.sender and h.sequence == tx.sequence
               for h in self.history):
            return False, "sequence の再利用 (二重支払い)"
        return True, "ok"

    def apply(self, tx: Payment) -> tuple[bool, str]:
        ok, why = self.validate(tx)
        if not ok:
            return False, why
        self.balances[tx.sender] -= tx.amount
        self.credit(tx.receiver, tx.amount)
        self.history.append(tx)
        return True, "ok"

    # --- アーカイブ側の視点 ---------------------------------------------
    def harvest_pubkeys(self) -> dict:
        """台帳を読むだけで手に入る公開鍵の一覧。誰でもできる。

        アーカイブ機関が「改竄検知のため」に台帳を長期保存するとき、
        同時にこの表も保存していることになる。
        """
        return {tx.sender: tx.pubkey for tx in self.history}


def forge_payment(
    grp: Group, recovered_x: int, sender: str, receiver: str,
    amount: int, sequence: int,
) -> Payment:
    """復元した秘密指数で、本人と区別できない送金を作る。

    台帳の検証規則から見て、これは «正当な取引» である。不正の痕跡は
    どこにも残らない。だから「あとで気づいて無効化する」ができない。
    """
    kp = KeyPair(grp, recovered_x, grp.exp(recovered_x))
    tmp = Payment(sender, receiver, amount, sequence, kp.y, Proof(0, 0))
    return Payment(sender, receiver, amount, sequence, kp.y,
                   prove(kp, ctx=tmp.message()))
