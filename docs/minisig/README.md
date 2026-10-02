# MiniSig

マルチシグウォレットを既製品に頼らず一から実装し、**Base Sepolia 上で実際に動かす**教材サイト。
ブラウザからも HTTP API からも操作できる。

**https://minisig-app.na-kamura-1263.workers.dev**

> テストネット上の教材です。価値のあるものを預けないでください。
> 実運用には [Safe](https://safe.global) を使ってください。

## これは何か

コントラクトは約 140 行の Solidity。仕組みは3つだけ。

1. 所有者リストと閾値を持つ
2. 「これから実行する取引」を一意なハッシュにする
3. そのハッシュへの署名を閾値の数だけ検証し、通れば実行する

秘密鍵はどこにも渡らない。署名から署名者を逆算（`ecrecover`）して照合するだけ。

コントラクト本体とテストは別リポジトリ（Foundry プロジェクト）にある。
このリポジトリは**そのフロントエンドと API**。

## 構成

| | |
|---|---|
| フレームワーク | Next.js 16（App Router, SSR） |
| 多言語 / テーマ | next-intl / next-themes（[テンプレート](https://github.com/nakamura196/nextjs-i18n-themes-ssr-template)由来） |
| チェーン接続 | viem |
| ホスティング | Cloudflare Workers（`@opennextjs/cloudflare`） |
| 提案・署名の保管 | Cloudflare KV |
| 図 | roughjs でビルド時に生成 → インライン SVG |

## ページ

| パス | 内容 |
|---|---|
| `/` | 何をするサイトか |
| `/minisig` | 操作画面（提案 → 署名 → 実行） |
| `/api-docs` | API リファレンス |
| `/api-docs/swagger` | Swagger UI |
| `/about` | このサイトについて、デプロイ済みコントラクト |
| `/api/openapi` | OpenAPI 3.1 定義 |

日本語（接頭辞なし）と英語（`/en/...`）。

## API

**サーバは秘密鍵を一切持たない。** 鍵が要る操作とそうでない操作の境界が、
そのまま API の境界になっている。

| メソッド | パス | |
|---|---|---|
| `GET` | `/api/minisig/{address}` | 所有者・閾値・nonce・残高 |
| `GET` | `/api/minisig/{address}/proposals` | 提案の一覧 |
| `POST` | `/api/minisig/{address}/proposals` | 提案を作る |
| `GET` | `/api/minisig/{address}/proposals/{id}` | 提案ひとつの状態 |
| `POST` | `/api/minisig/{address}/proposals/{id}/signatures` | 署名を追加する |
| `GET` | `/api/minisig/{address}/proposals/{id}/calldata` | 送信できる calldata |

**署名の生成と送信だけがクライアント側**にある。`calldata` は送信可能なバイト列を
返すだけで、broadcast はしない。ガスを払う鍵がサーバに無いため。

### 設計上、意図してそうしていること

- **`txHash` をクライアントから受け取らない。** 必ずコントラクトに計算させる。
  クライアントが計算したハッシュを信用すると、そこが改竄点になる
- **署名者を自己申告させない。** サーバが署名から署名者を復元し、
  チェーン上の所有者リストと照合する

## 開発

```
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm run lint
```

図を描き直したとき:

```
node scripts/gen-figures.mjs
```

`seed` を固定しているので、再生成しても差分は出ない。

## デプロイ

```
npm run deploy       # sync:swagger && opennextjs-cloudflare build && deploy
```

**`npx opennextjs-cloudflare deploy` を直接叩かないこと。** ビルドが走らず、
前回の成果物がデプロイされる。

KV 名前空間は `wrangler.jsonc` の `PROPOSALS`。型は次で再生成する。

```
npm run cf-typegen
```

## 引っかかったところ

このプロジェクトで実際に踏んだもの。同じ構成を組む人向けに残す。

- **Next.js 16 の `proxy.ts` は Cloudflare にデプロイできない。**
  proxy は必ず Node.js ランタイムで動き、`@opennextjs/cloudflare` が未対応
  （[#962](https://github.com/opennextjs/opennextjs-cloudflare/issues/962)）。
  Edge で動く従来の `middleware.ts` に戻して回避している
- **ミドルウェアの matcher `(?!api|...)` は `/api-docs` にも一致する。**
  ページがロケール振り分けから外れ、**日本語版だけ 404** になる。`(?!api/|...)` と書く
- **公開 RPC は Workers から弾かれやすい。** 送信元 IP を多数のテナントで共有するため。
  `batch: true` で複数の `eth_call` を1往復にまとめると安定する
- **roughjs の `toPaths()` は `strokeLineDash` を返さない。** 破線は生成側で明示的に持つ
- **`swagger-ui-react` は使っていない。** React 19 との相性が悪く依存も重い。
  `swagger-ui-dist` を `public/` に同期して script タグで読んでいる

## ライセンス

MIT
