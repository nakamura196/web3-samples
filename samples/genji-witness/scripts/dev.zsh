#!/usr/bin/env zsh
# ローカルの anvil を立てて CorpusAnchor を配置する。
#
#   前提: foundry (anvil / forge / cast) が入っていること
#   使い方: ./scripts/dev.zsh          … 起動したままにする (Ctrl-C で終了)
#           PORT=8549 ./scripts/dev.zsh
#
# 外部 RPC も鍵も資金も要らない。ここで使う鍵は anvil の既定アカウントで、
# **公開されている鍵**なのでローカル専用。公開チェーンには絶対に使わない。
#
# 役を 3 つ用意する理由:
#   校異源氏物語では、記録を作る人 (中村) と記録される対象が同じである。
#   自分で自分の版を刻むだけなら署名で足りる。意味が出るのは
#   **第三者が同じ root を独立に刻んだとき**なので、その 2 人分も用意する。
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
PORT="${PORT:-8548}"
RPC="http://127.0.0.1:$PORT"

# anvil の既定アカウント (公開されている値。ローカル専用)
PUBLISHER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266      # 校異源氏物語を公開している側
PUBLISHER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
WITNESS_A=0x70997970C51812dc3A010C7d01b50e0d17dc79C8      # 独立に検証した第三者 (研究者)
WITNESS_B=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC      # 独立に検証した第三者 (図書館)

# 先に生きている anvil がいると、起動に失敗したことに気づかず**古い鎖に配置**して
# しまう (アドレスが変わり、前の記録が混ざる)。ここで止める。
if cast chain-id --rpc-url "$RPC" >/dev/null 2>&1; then
  echo "port $PORT で既に何かが動いています。先に止めるか PORT=8549 で起動してください。" >&2
  exit 1
fi

echo "── anvil を起動 (port $PORT) ────────────────────────────────"
anvil --port "$PORT" --silent &
ANVIL_PID=$!
trap 'kill $ANVIL_PID 2>/dev/null || true' EXIT INT TERM

for i in {1..40}; do
  if cast chain-id --rpc-url "$RPC" >/dev/null 2>&1; then break; fi
  sleep 0.25
done
cast chain-id --rpc-url "$RPC" >/dev/null

echo "── CorpusAnchor を配置 ─────────────────────────────────────"
cd "$ROOT/contracts"
forge build >/dev/null

# forge create --json の出力には lint の警告が混じるので deployedTo だけ取り出す
ANCHOR=$(forge create "src/CorpusAnchor.sol:CorpusAnchor" --rpc-url "$RPC" --private-key "$PUBLISHER_KEY" --broadcast --json 2>/dev/null | grep -o '"deployedTo"[: ]*"0x[0-9a-fA-F]*"' | head -1 | grep -o '0x[0-9a-fA-F]*')
echo "  CorpusAnchor   $ANCHOR"

cd "$ROOT"
mkdir -p out
# deployed.json には **アドレスだけ**を書く。秘密鍵はファイルに残さない
# (anvil の既定鍵は公開値だが、鍵をファイルに置く形を癖にしないため)。
# 送信は anvil が開錠済みのアカウントを署名する eth_sendTransaction で行う。
node -e '
const [rpc, chainId, anchor, publisher, a, b] = process.argv.slice(1);
require("fs").writeFileSync("out/deployed.json", JSON.stringify({
  rpc, chainId: Number(chainId), corpusAnchor: anchor,
  note: "anvil の開錠済みアカウント。署名は anvil 側で行うので鍵は保存しない",
  accounts: {
    publisher: {address: publisher, role: "校異源氏物語を公開している側"},
    witnessA:  {address: a, role: "独立に検証した第三者 (研究者)"},
    witnessB:  {address: b, role: "独立に検証した第三者 (図書館)"},
  },
}, null, 2) + "\n");
' "$RPC" "$(cast chain-id --rpc-url "$RPC")" "$ANCHOR" "$PUBLISHER" "$WITNESS_A" "$WITNESS_B"

echo ""
echo "out/deployed.json に書きました。この端末は起動したままにしてください。"
echo ""
echo "別の端末で:"
echo "  node scripts/01-digest.mjs"
echo "  node scripts/02-anchor.mjs"
echo "  node scripts/03-prove.mjs 1001-01"
echo "  node scripts/04-permanence.mjs"
echo "  node scripts/05-compare.mjs"
echo ""
wait $ANVIL_PID
