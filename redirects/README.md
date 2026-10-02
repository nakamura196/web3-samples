# 旧 URL からの転送

2026-10-01 に 4 つのアプリをこのリポジトリへまとめた。旧 URL を開いた人を、
新しいサイトの同じページへ送るための設定がここにある。中身は転送だけで、依存はない。

| 旧 URL | 置き場所 | 配り方 |
|---|---|---|
| https://minisig-app.na-kamura-1263.workers.dev | `workers/minisig-app` | `cd workers/minisig-app && npx wrangler deploy` |
| https://st-registry.na-kamura-1263.workers.dev | `workers/st-registry` | `cd workers/st-registry && npx wrangler deploy` |
| https://chain-lens-amber.vercel.app | `vercel/chain-lens` | `cd vercel/chain-lens && npx vercel deploy --prod` |
| https://tictactoe-onchain.vercel.app | `vercel/tictactoe-onchain` | `cd vercel/tictactoe-onchain && npx vercel deploy --prod` |

ページは 301、API（POST を含む）は 308 で送る。308 はメソッドと本文を保つ。
