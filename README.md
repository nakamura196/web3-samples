# Web3 Samples

ブロックチェーンの仕組みを、動くものを触りながら確かめるための練習アプリ集です。
すべてテストネットで動き、本物のお金は使いません。

公開先: https://web3-samples.na-kamura-1263.workers.dev

| サンプル | 内容 | URL |
|---|---|---|
| MiniSig | マルチシグウォレットを一から作り、Base Sepolia で動かす | `/minisig` |
| 不動産ST 記述レジストリ | 同じ稼働率 100% でも、記述の違いでコントラクトの判断が変わる | `/st-registry` |
| Chain Lens | 実際の取引を読み、何が公開・暗号化・未記録かを確かめる | `/chain-lens` |
| オンチェーン まるばつ | コントラクトだけで動く、賭け金つきのまるばつ | `/tictactoe` |

英語版は `/en/<サンプル>` です。

## 構成

```
src/app/[locale]/<slug>/   各サンプルのページ
src/samples/<slug>/        各サンプルの部品・文言・処理
src/app/api/minisig/       MiniSig の API（提案と署名の保管、Cloudflare KV）
contracts/<slug>/          コントラクト（Foundry）。forge-std は contracts/lib を共有
samples/                   配布していない手元の試作（xrpl-granary・genji-witness・zk-shor）
docs/<slug>/               統合前の各リポジトリの README など
```

## 動かす

```
git clone --recurse-submodules https://github.com/nakamura196/web3-samples.git
npm ci
npm run dev        # http://localhost:3000
npm run preview    # 本番と同じ Cloudflare Workers の環境で確かめる
npm run deploy     # Cloudflare Workers へ配布
```

環境変数は `.env.example` を参照してください（秘密情報は使いません）。

コントラクトのテスト:

```
cd contracts/minisig && forge test
```

## 統合前のリポジトリ

2026-10-01 に次のリポジトリから移しました。履歴は元のリポジトリに残っています。

- [nakamura196/minisig-app](https://github.com/nakamura196/minisig-app) と [nakamura196/minisig](https://github.com/nakamura196/minisig)
- [nakamura196/chain-lens](https://github.com/nakamura196/chain-lens)
- st-registry、tictactoe-onchain（GitHub には未公開だったもの）

## ライセンス

MIT
