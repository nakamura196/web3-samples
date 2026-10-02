# 作り方の指針

## 構成

```
contracts/            Foundry
  src/                PropertyRegistry / Token / Settlement / ConfidentialRent
  test/               Dvp.t.sol(7) Currency.t.sol(3)
  script/Deploy.s.sol 銘柄A(根拠つき)と銘柄B(根拠なし)を用意して配備
  verify_confidential.zsh   anvil と sapphire で漏れを比較する
src/lib/chain.ts      ABI とアドレス。anvil / sepolia / sapphire を env で切替
src/components/       PropertyCard(記述と担保) ConfidentialPanel(非開示のまま判定)
src/app/[locale]/     日英 2 言語
```

## 型で守る

**測定値は「値・根拠・基準時点」の 3 つで 1 組。**

```solidity
struct Measure { uint256 value; bytes32 basis; uint64 asOf; bool set; }
```

`record()` は根拠か基準時点が欠けた値の**登録そのものを拒否する**。
「ただの稼働率」を書き込むことが型として不可能になっている。
目論見書が括弧書きで守っていた規律を、契約の型に移したもの。

## 走らせ方

```
cd contracts && forge test              コントラクトのテスト
anvil                                   ローカルのチェーン
npm run contracts:deploy:local          ローカルへ配備
npm run dev -- --port 3001              3000 は genji-x が使っていることがある
npm run deploy                          Cloudflare へ
```

チェーンの切り替えは `.env.local` の `NEXT_PUBLIC_CHAIN`(`anvil` / `sepolia` / `sapphire`)。

## 日本語

genji-x の用語表に従う。**辞書に無い日本語を作らない。**
DvP / ERC-20 / EVM / revert / LTV は原語のまま。
「刻む」「窓口」「利用の券」のような造語を作らない。

## データの出どころを書く

数値には必ず出どころを添える。**この試作自体がその主張なので、コードでも守る。**

- 面積・鑑定評価額・稼働率 … 公開されている目論見書の実数
- 賃料 … 仮の値(目論見書では「非開示」)
- 借入可能額 … 掛け目 50% という仮定からの計算値。根拠となる文書はない
- 銘柄名 … 架空
