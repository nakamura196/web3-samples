#!/usr/bin/env zsh
# Sepolia をフォークした anvil を立てる。Ocean Protocol の**本物のコントラクト**に
# 対して発行を試すため。
#
#   使い方: ./scripts/ocean-fork.zsh     … 起動したままにする (Ctrl-C で終了)
#           PORT=8550 ./scripts/ocean-fork.zsh
#
# フォークなので、送るトランザクションは手元の anvil の中だけで完結する。
# **公開チェーンには何も残らない。** 資金も鍵も要らない (anvil が既定アカウントに
# 10000 ETH を積む。その鍵は公開されている値なのでローカル専用)。
#
# フォーク元 (https://ethereum-sepolia-rpc.publicnode.com) は読むだけに使う。
set -euo pipefail

cd "$(dirname "$0")/.."
PORT="${PORT:-8549}"
RPC="http://127.0.0.1:$PORT"
UPSTREAM="${SEPOLIA_UPSTREAM:-https://ethereum-sepolia-rpc.publicnode.com}"

# dev.zsh と同じ理由。先に生きている anvil がいると、起動に失敗したことに
# 気づかず**別の鎖に対して送って**しまう。
if cast chain-id --rpc-url "$RPC" >/dev/null 2>&1; then
  echo "port $PORT で既に何かが動いています。先に止めるか PORT=8550 で起動してください。" >&2
  exit 1
fi

echo "── Sepolia をフォークして anvil を起動 (port $PORT) ──────────"
echo "   フォーク元: $UPSTREAM"
anvil --fork-url "$UPSTREAM" --port "$PORT" --silent &
ANVIL_PID=$!
trap 'kill $ANVIL_PID 2>/dev/null || true' EXIT INT TERM

# フォークは最初のブロック取得に時間がかかるので長めに待つ
for i in {1..120}; do
  if cast chain-id --rpc-url "$RPC" >/dev/null 2>&1; then break; fi
  sleep 0.5
done

CHAIN_ID=$(cast chain-id --rpc-url "$RPC")
BLOCK=$(cast block-number --rpc-url "$RPC")
if [[ "$CHAIN_ID" != "11155111" ]]; then
  echo "chainId が $CHAIN_ID です。Sepolia (11155111) をフォークできていません。" >&2
  exit 1
fi
echo "   chainId $CHAIN_ID / block $BLOCK"

# Ocean のコントラクトが本当にそこに居るかを、送る前に確かめる。
# フォークが空振りしていると、コードが無いアドレスに送って
# 「revert もせず何も起きない」形の失敗になる。
echo ""
echo "── Ocean のバイトコードを確認 ───────────────────────────────"
check() {
  local name=$1 addr=$2
  local len=$(( ${#$(cast code "$addr" --rpc-url "$RPC")} / 2 - 1 ))
  if (( len <= 0 )); then
    echo "  $name  $addr  コードがありません" >&2
    return 1
  fi
  printf "  %-18s %s  %'d バイト\n" "$name" "$addr" "$len"
}
check ERC721Factory  0xEF62FB495266C72a5212A11Dce8baa79Ec0ABeB1
check ERC721Template 0x9C9eE07b8Ce907D2f9244F8317C1Ed29A3193bAe
check ERC20Template2 0xDEfD0018969cd2d4E648209F876ADe184815f038
check Dispenser      0x2720d405ef7cDC8a2E2e5AeBC8883C99611d893C

echo ""
echo "この端末は起動したままにしてください。別の端末で:"
echo "  node scripts/06-ocean.mjs"
echo ""
wait $ANVIL_PID
