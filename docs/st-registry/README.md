# st-registry

不動産セキュリティトークン(ST)の**記述**を機械可読な形でチェーンに置く試作。

**https://st-registry.na-kamura-1263.workers.dev/ja**

## 何を示すか

稼働率はどちらも 100%。数値はまったく同じ。それでも片方は担保に取れて、
片方はコントラクトが実行を拒否する。

| | 物件α | 物件β |
|---|---|---|
| 稼働率 | 100.0%（**面積ベース**） | 100.0%（**宣言なし**） |
| 担保余力 | ¥4,300,000,000 | `revert UnusableOccupancyBasis(UNDECLARED)` |

分母が分からない稼働率では、担保価値を計算しようがない。**拒否する以外に正しい振る舞いがない。**

もう 1 つ。目論見書には「賃料及び共益費 ── 非開示」と書かれた項目がある(賃借人の同意が
得られないため)。しかし担保評価には賃料が要る。秘匿 EVM の上なら、賃料をチェーンに
置いたまま「基準を満たすか」だけを返せる。**ふつうの EVM では `private` にしても
ストレージから読めてしまう。**

```
contracts/verify_confidential.zsh anvil      → 賃料が読める
contracts/verify_confidential.zsh sapphire   → 読めない
```

同じコード。置いた場所だけの違い。

## 由来

UBC Blockchain Summer Institute 2026 Day 8(規制とガバナンス)からの派生。
2026-08-26 に国内の不動産 ST 11 銘柄の記述を突き合わせたところ、目論見書は数値に必ず
根拠と基準時点を添える(「延床面積（登記簿）」「稼働率（面積ベース）」)のに、
運用サイトではそれが落ちていた。**標準が無いのではなく、継続更新される層へ
引き継がれていない。** この試作はその欠落を埋めたらどうなるかを示す。

雛形は [genji-x](../genji-x)(Next.js 16 + next-intl + viem + OpenNext)。

## データについて

- **銘柄名は架空**
- 面積・鑑定評価額・稼働率 … 公開されているケネディクス物流 3 件の目論見書(2025年5月)の実数
- 賃料 … **仮の値**(目論見書では「非開示」)
- 借入可能額 … 掛け目 50% という**仮定**からの計算値。根拠となる文書はない
- **テストネット限定。実在の金融商品ではない**

## チェーン

Oasis Sapphire Testnet (chain 23295)。組織登録は不要。

| | |
|---|---|
| PropertyRegistry | `0x691Ac741DcBd4bfda5396Efbb669856eDEfd0afa` |
| CollateralVault | `0xC6Ee156f44d9aAE39cC5E751cc891bE5DA071A8F` |
| ConfidentialRent | `0xf8Df722408697587dbDb3A0e4508267BC23bDa12` |
| DvPSettlement | `0x343D268cA259e7ad88810347A942743c5001C575` |
| SecurityToken α / β | `0xB303b5…535b` / `0x72b6F5…7bdD` |

## 走らせる

```
cd contracts && forge test          コントラクトのテスト(10 件)
npm install
npm run dev -- --port 3001
```

作り方は [GUIDELINES.md](GUIDELINES.md)、進め方は [CLAUDE.md](CLAUDE.md)。
