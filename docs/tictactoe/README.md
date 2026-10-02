# tictactoe-onchain

まるばつゲームを、スマートコントラクトだけで動かす。Solidity で書いた 2 つのコントラクトと、
それを操作する Next.js のフロントエンドで構成されています。**テストネット専用**です。

- **人間同士の対戦** — 両者が同額を賭け、勝者がポットを総取り。引き分けは返金
- **CPU 対戦** — Solidity で書かれた相手と練習。賭けなし、強さ 3 段階
- **放置対策** — 手番のプレイヤーが持ち時間を切らすと、相手が不戦勝でポットを受け取る

## 構成

```
contracts/          Foundry。コントラクト本体とテスト
  src/
    Board.sol            盤面のビット演算（ライブラリ。デプロイされない）
    TicTacToe.sol        対人戦。賭け金をエスクローする
    SoloTicTacToe.sol    CPU 戦。賭けなし
    learn/               アプリからは使わない、読むためだけの最小コントラクト
  test/             Solidity で書くテスト
  script/Deploy.s.sol
web/                Next.js 16 + next-intl + wagmi + viem
  src/generated/    forge の出力から自動生成される ABI と型付きフック（手で触らない）
scripts/            補助スクリプト
```

`Board.sol` は関数がすべて `internal` なので、**デプロイされません**。コンパイル時に
`TicTacToe` と `SoloTicTacToe` のバイトコードへそれぞれインライン展開されます。この 2 つの
コントラクトは実行時に一切呼び合いません。独立した 2 つのデプロイです。

## 必要なもの

- [Foundry](https://getfoundry.sh)（`forge` / `cast` / `anvil`）
- Node.js 20 以降
- MetaMask などのブラウザウォレット

## ローカルで動かす

```
git clone <this repo>
cd tictactoe-onchain
git submodule update --init --recursive
```

**1. チェーンを立てる**（別ターミナルで開いたまま）

```
anvil
```

使い捨ての Ethereum がメモリ上に立ちます。ディスクには何も書かれないので、
プロセスを落とせばチェーンごと消えます。

**2. コントラクトをデプロイする**

```
cd contracts
forge test
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

この秘密鍵は anvil が起動時に表示する開発用アカウントのもので、**公開されている値**です。
本物のネットワークでは絶対に使わないでください。

出力の末尾に `.env.local` へ貼る 2 行が表示されます。

**3. フロントを起動する**

```
cd ../web
npm install
cp .env.example .env.local     # 上で出たアドレスを書き込む
npm run wagmi                  # ABI と型付きフックを生成
npm run dev
```

**4. MetaMask をローカルチェーンに向ける**

- ネットワークを追加：RPC `http://127.0.0.1:8545`、Chain ID `31337`、通貨記号 `ETH`
- anvil が表示する秘密鍵を 2 つインポートすれば、1 人で対戦できます

## コントラクトを変えたとき

```
cd contracts && forge build
cd ../web && npm run wagmi
```

**この順序を守ってください。** `web/src/generated/wagmi.ts` は `forge build` の出力から
生成されます。手で編集しても次の生成で消えますし、ABI とコントラクトがずれると
「ビルドは通るのに実行時に落ちる」という一番厄介な壊れ方をします。

## テスト

```
cd contracts
forge test                 # 全部
forge test -vvvv           # 実行トレース付き
forge test --gas-report    # 関数ごとのガス消費
forge coverage
```

`test_HardNeverLoses` は、Hard の CPU に対して**あらゆる合法手順を全探索**し、人間が
勝てる筋が 1 つも存在しないことを検証します。「たぶん強い」ではなく証明です。

## テストネットへのデプロイ

対応チェーンは Base Sepolia (84532) と Sepolia (11155111) です。
**メインネットは意図的に対応チェーン一覧から外してあります**（本物の ETH を賭けられないように）。

```
cd contracts
forge script script/Deploy.s.sol --rpc-url https://sepolia.base.org --broadcast --verify --private-key $PRIVATE_KEY
```

`--verify` を付けると Basescan にソースが公開され、ブラウザ上に Read / Write タブが
生えます。フロントを書く前の動作確認に便利です。

`FEE_BPS`（0〜500）で、決着したゲームのポットから引く手数料を指定できます。既定は 0 で、
引き分けと取り消しからは取りません。

秘密鍵をシェル履歴に残さないため、`PRIVATE_KEY` は 1Password などから注入してください。

```
PRIVATE_KEY=$(op read "op://Personal/<item>/private_key") forge script ...
```

## 学習用の最小コントラクト

`contracts/src/learn/` の 3 ファイルは、アプリから一切使われません。読む順に並んでいます。

| ファイル | 内容 |
|---|---|
| `Step0Number.sol` | 数を 1 つ覚えるだけ。これ以上削れない |
| `Step1Storage.sol` | 状態の永続、`msg.sender`、イベント、`revert` |
| `Step2MinimalTicTacToe.sol` | まるばつの全部。ライブラリなし、ビット演算なし、お金なし |

CLI だけでコントラクトを 8 通りに覗くスクリプトも置いてあります。

```
./scripts/walkthrough-step0.zsh
```

インターフェース、ストレージ配置、逆アセンブル、送信されるバイト列、書き込みのガス代、
生のストレージスロットまでを順に表示します。

## ライセンス

MIT
