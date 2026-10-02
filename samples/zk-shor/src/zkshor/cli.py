"""デモの入口。python -m zkshor <command>"""

from __future__ import annotations

import argparse
import sys
import time

from . import attacks, estimate, group, ledger, schnorr, shor_dlog, shor_factor


def rule(title: str) -> None:
    print()
    print("=" * 72)
    print(f"  {title}")
    print("=" * 72)


def sub(title: str) -> None:
    print()
    print(f"--- {title} " + "-" * max(0, 66 - len(title)))


# ---------------------------------------------------------------------------

def cmd_zkp(args) -> None:
    rule("1. ゼロ知識証明を組む (実運用サイズ)")
    print("パラメータ生成中 ... (初回のみ数秒。以後 params/ にキャッシュ)")
    t0 = time.time()
    grp = group.real(args.qbits, args.pbits)
    print(f"{grp.describe()}  [{time.time()-t0:.1f}s]")

    kp = schnorr.keygen(grp)
    print(f"秘密 x    : {str(kp.x)[:24]}...  ({kp.x.bit_length()} bit)")
    print(f"公開 y=g^x: {str(kp.y)[:24]}...  ({kp.y.bit_length()} bit)")

    sub("完全性 — 正直な証明は通る")
    ctx = b"I am the holder of this key, 2026-08-21"
    pf = schnorr.prove(kp, ctx)
    print(f"証明 (t, s) の大きさ: {(pf.t.bit_length()+pf.s.bit_length())//8} バイト")
    print(f"検証: {schnorr.verify(grp, kp.y, pf, ctx)}")

    sub("文脈を1文字変えると通らない (署名として機能する)")
    print(f"検証: {schnorr.verify(grp, kp.y, pf, ctx + b'!')}")

    sub("知らない人は通せない (健全性)")
    fake = schnorr.keygen(grp)
    stolen = schnorr.prove(fake, ctx)
    print(f"他人の証明を y に対して検証: {schnorr.verify(grp, kp.y, stolen, ctx)}")

    sub("証明から x は漏れない (ゼロ知識)")
    print("秘密を持たない simulate() が、本物と同じ分布の transcript を作る:")
    for _ in range(3):
        tr = schnorr.simulate(grp, kp.y)
        print(f"  simulated 検証 = {schnorr.verify_transcript(grp, kp.y, tr)}"
              f"  (t={str(tr.t)[:16]}...)")
    print("本物と見分けがつかない => 見た人が得る情報は 0。これがゼロ知識の意味")

    sub("健全性の «証明» は、そのまま攻撃コードでもある")
    r, t = schnorr.commit(grp)
    tr1 = schnorr.Transcript(t, 111, schnorr.respond(grp, kp.x, r, 111))
    tr2 = schnorr.Transcript(t, 222, schnorr.respond(grp, kp.x, r, 222))
    got = schnorr.extract(grp, tr1, tr2)
    print(f"同じ t で 2 本 => x を復元: {got == kp.x}")


def cmd_classical(args) -> None:
    rule("2. 古典的な破り方 — Shor を出す前に")
    grp = group.toy(args.qbits)
    kp = schnorr.keygen(grp)
    print(f"{grp.describe()}")
    print(f"秘密 x = {kp.x}  (答え合わせのためだけに表示)")

    sub("(a) nonce 使い回し — 実装のバグ。O(1)")
    r, t = schnorr.commit(grp)
    tr1 = schnorr.Transcript(t, 7, schnorr.respond(grp, kp.x, r, 7))
    tr2 = schnorr.Transcript(t, 9, schnorr.respond(grp, kp.x, r, 9))
    res = attacks.nonce_reuse(grp, tr1, tr2)
    print(f"x = {res.x}  ({res.ops} 演算)  正解: {res.x == kp.x}")
    print("PS3 (2010) と Android 由来の Bitcoin 流出 (2013) はこれ")

    sub("(b) baby-step giant-step — 正攻法。O(sqrt(q))")
    res = attacks.bsgs(grp, kp.y)
    print(f"x = {res.x}  ({res.ops} 演算)  正解: {res.x == kp.x}")

    sub("(c) Pollard rho — 同じ計算量、メモリ O(1)")
    res = attacks.pollard_rho(grp, kp.y)
    print(f"x = {res.x}  ({res.ops} 演算)  正解: {res.x == kp.x}")

    print()
    print("これらは q を大きくすれば必ず負ける。256 bit なら 2^128 演算。")
    print("だから今日の Schnorr / ECDSA は «安全» と言える。")


def cmd_shor(args) -> None:
    rule("3. Shor の離散対数アルゴリズム — 前提そのものを壊す")
    grp = group.toy(args.qbits)
    kp = schnorr.keygen(grp)
    print(f"{grp.describe()}")
    print(f"公開されているのは y = {kp.y} だけ。x は隠されている")
    print()

    res = shor_dlog.shor_dlog(grp, kp.y, seed=args.seed)
    print()
    if res.ok:
        print(f"復元した x = {res.x}   本物の x = {kp.x}   一致: {res.x == kp.x}")
        print(f"測定 {res.shots} 回 / {res.seconds:.2f} 秒")
        print(f"d == c*x mod q が厳密に成立: {res.exact}")
    else:
        print("失敗 (確率的。もう一度実行のこと)")

    if args.peaks:
        sub("干渉の確認 — 「たまたま当たった」のではないこと")
        info = shor_dlog.peak_structure(grp, kp.y, seed=args.seed)
        print(f"直線 d = c*x 上の確率合計 : {info['prob_on_line']:.12f}")
        print(f"直線から外れた確率の合計   : {info['prob_off_line']:.3e}")
        print(f"外れた最大の確率           : {info['max_off_line']:.3e}")
        print(f"確率が非ゼロな格子点        : {info['nonzero_cells']} / {info['q']**2}")
        print("QFT が «傾き x» 以外の可能性を全部打ち消している")

    if res.ok:
        sub("秘密を手に入れた者は、本物と区別できない証明を作れる")
        forged = schnorr.KeyPair(grp, res.x, grp.exp(res.x))
        ctx = b"I am the holder of this key, 2026-08-21"
        pf = schnorr.prove(forged, ctx)
        print(f"偽の証明の検証結果: {schnorr.verify(grp, kp.y, pf, ctx)}")
        print("ゼロ知識性は保たれたまま、«知識» の側が消えた。")
        print("プロトコルは無傷で、仮定だけが壊れる ——それがこの攻撃の性質")


def cmd_factor(args) -> None:
    rule("4. 教科書の Shor — 素因数分解と RSA")
    rsa = shor_factor.toy_rsa()
    print(f"玩具 RSA: N = {rsa.n}, e = {rsa.e}  (公開)")
    print(f"          d = {rsa.d}                (秘密)")
    msg = 42
    ct = rsa.encrypt(msg)
    print(f"暗号化: {msg} -> {ct}")
    print()

    res = shor_factor.shor_factor(rsa.n, seed=args.seed)
    print()
    if res.ok:
        d = shor_factor.recover_rsa_private_key(rsa.n, rsa.e, res.factors)
        print(f"因数分解: N = {res.factors[0]} x {res.factors[1]}")
        print(f"再構成した d = {d}  (本物 {rsa.d}, 一致: {d == rsa.d})")
        print(f"復号: {pow(ct, d, rsa.n)}  (元の平文 {msg})")
        print(f"論理量子ビット {res.qubits} / 測定 {res.shots} 回 / {res.seconds:.2f} 秒")
    else:
        print("失敗 (確率的。もう一度実行のこと)")


def cmd_ledger(args) -> None:
    rule("5. 台帳 — harvest now, forge later")
    grp = group.toy(args.qbits)
    alice = ledger.Account(grp, schnorr.keygen(grp))
    bob = ledger.Account(grp, schnorr.keygen(grp))
    mallory = ledger.Account(grp, schnorr.keygen(grp))

    book = ledger.Ledger(grp)
    book.credit(alice.address, 1000)
    print(f"Alice   {alice.address}  残高 1000")
    print(f"Bob     {bob.address}")
    print(f"Mallory {mallory.address}  (攻撃者)")

    sub("2026年 — Alice が普通に送金する")
    tx = alice.pay(bob.address, 100)
    ok, why = book.apply(tx)
    print(f"送金 100: {ok} ({why})")
    print(f"この取引と一緒に、Alice の公開鍵 {tx.pubkey} が台帳に載った")
    print("以後この値は永久に消えない。それが台帳の «長所» である")

    sub("2026年 — Mallory が Alice になりすまそうとする")
    bad = ledger.forge_payment(grp, mallory.kp.x, alice.address,
                               mallory.address, 900, 2)
    print(f"結果: {book.apply(bad)}")

    sub("20XX年 — アーカイブされた台帳から公開鍵を収穫する")
    harvest = book.harvest_pubkeys()
    print(f"収穫: {harvest}")
    print("台帳を読むだけ。特別な権限も侵入も要らない")

    sub("20XX年 — 量子計算機で秘密鍵を再構成する")
    res = shor_dlog.shor_dlog(grp, harvest[alice.address], seed=args.seed,
                              verbose=args.verbose)
    if not res.ok:
        print("Shor 失敗 (確率的)。もう一度実行のこと")
        return
    print(f"復元した Alice の秘密鍵: {res.x}  (本物 {alice.kp.x}, "
          f"一致 {res.x == alice.kp.x})")

    sub("20XX年 — 偽の送金を通す")
    forged = ledger.forge_payment(grp, res.x, alice.address,
                                  mallory.address, 900, 2)
    ok, why = book.apply(forged)
    print(f"結果: {ok} ({why})")
    print(f"Alice 残高 {book.balances[alice.address]} / "
          f"Mallory 残高 {book.balances[mallory.address]}")
    print()
    print("台帳の検証規則から見て、この取引は «正当» である。")
    print("署名は正しく、アドレスも一致し、二重支払いでもない。")
    print("不正の痕跡はどこにも残らない ——だから後から無効化もできない。")
    print()
    print("XRPL は secp256k1 / Ed25519、Ethereum は secp256k1。")
    print("いずれもここで壊した «離散対数の困難性» と同じ仮定に乗っている。")


def cmd_estimate(args) -> None:
    rule("6. では本番サイズは？")
    print(estimate.report(args.qbits if args.qbits > 32 else 256))
    print()
    print(estimate.table())


def cmd_all(args) -> None:
    cmd_zkp(args)
    small = argparse.Namespace(**{**vars(args), "qbits": args.toybits})
    cmd_classical(small)
    cmd_shor(small)
    cmd_factor(small)
    cmd_ledger(small)
    cmd_estimate(args)
    rule("まとめ")
    print("""
同じ Schnorr の実装が、パラメータの大きさだけで安全にも危険にもなる。
古典的な攻撃 (bsgs / rho) は q を大きくすれば逃げ切れる。
Shor は逃げ切れない。q を倍にしても、量子側の費用は多項式でしか増えない。

アーカイブにとっての帰結:
  - 署名や証明の «証拠能力» は «今の計算機では破れない» に依存している
  - 保存期間が長いほど、その依存は危うくなる (harvest now, forge later)
  - 台帳やリポジトリに公開鍵を残すこと自体が、将来の攻撃面になる
  - 対策は暗号だけでは閉じない。タイムスタンプ、来歴記録、
    複数の独立した証拠の重ね合わせ ——つまり従来のアーカイブの作法に戻る
""".strip())


# ---------------------------------------------------------------------------

def main(argv=None) -> int:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--qbits", type=int, default=256, help="実サイズ側の q のビット長")
    common.add_argument("--pbits", type=int, default=2048, help="実サイズ側の p のビット長")
    common.add_argument("--toybits", type=int, default=10, help="玩具側の q のビット長")
    common.add_argument("--seed", type=int, default=None, help="再現用の乱数シード")
    common.add_argument("--peaks", action="store_true", help="QFT の干渉構造も表示")
    common.add_argument("-q", "--quiet", dest="verbose", action="store_false",
                        default=True)

    ap = argparse.ArgumentParser(
        prog="zkshor",
        description="ゼロ知識証明を実装し、Shor のアルゴリズムで破る",
        parents=[common],
    )
    sp = ap.add_subparsers(dest="cmd")
    for name, fn, doc in [
        ("zkp", cmd_zkp, "実サイズで Schnorr を組み、3性質を確認する"),
        ("classical", cmd_classical, "nonce 再利用 / bsgs / rho で破る"),
        ("shor", cmd_shor, "Shor の離散対数で秘密鍵を取り出す"),
        ("factor", cmd_factor, "Shor の素因数分解で玩具 RSA を破る"),
        ("ledger", cmd_ledger, "台帳から公開鍵を収穫し、偽の送金を通す"),
        ("estimate", cmd_estimate, "本番サイズの費用を見積もる"),
        ("all", cmd_all, "全部順に流す"),
    ]:
        s = sp.add_parser(name, help=doc, parents=[common])
        s.set_defaults(func=fn)

    args = ap.parse_args(argv)
    if not getattr(args, "func", None):
        ap.print_help()
        return 1
    # サブコマンド側で qbits の意味が変わるので調整
    if args.cmd in ("classical", "shor", "ledger"):
        args.qbits = args.toybits
    args.func(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
