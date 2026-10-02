@AGENTS.md

# web3-samples で作業するときの決まり

Web3 の練習・サンプルアプリを 1 つにまとめたリポジトリ。
**1 つの Next アプリ・1 つの Worker** にして、依存の更新と配布を 1 回で済ませるのが目的
（以前は 4 リポジトリ・4 回の配布だった）。

## 形

- 部屋（サンプル）は `src/app/[locale]/<slug>/`（ページ）と `src/samples/<slug>/`（部品・文言・処理）
- 部屋の中のリンクは `@/samples/<slug>/nav` を使う。ここが `/<slug>` を前置する。
  **`@/i18n/routing` を部屋の中で直接使わない**（部屋の外のトップへ飛んでしまう）
- 文言は `src/samples/<slug>/messages/{ja,en}.json`。呼ぶときは `useTranslations('<slug>.X')`
- 部屋を足すときは `src/samples/index.ts` に 1 行、`src/i18n/request.ts` に 1 行、
  `src/messages/*.json` の Portal.samples に説明を足す
- API は部屋の外（`/api/minisig/...`）。URL を変えないため
- コントラクトは `contracts/<slug>/`（Foundry）。forge-std は `contracts/lib/` を共有
- `samples/` は配布しない手元の試作を置いておくだけの場所。ビルド・型検査の対象外

## 終わったと言う前に

- `npm run typecheck` と `node scripts/audit.mjs`
- 画面に関わる変更は `npm run preview`（本番と同じ Workers の環境）で開いて確かめる。
  `next dev` だけで済ませない
- コントラクトを変えたら `cd contracts/<slug> && forge test`

## 配布

`npm run deploy`（Cloudflare Workers、手動）。公開値は `.env.production` にある。
秘密情報は置かない。各部屋の個別の決まりは `docs/<slug>/` を読む。
