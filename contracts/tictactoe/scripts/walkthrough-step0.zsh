#!/usr/bin/env zsh
#
# walkthrough-step0.zsh — see a contract from every angle, using only the CLI.
#
# Deploys src/learn/Step0Number.sol (one storage variable, one setter) to a
# throwaway local chain and then looks at it eight different ways: its interface,
# its storage layout, the machine code it compiled to, the bytes a call sends,
# what a write costs, and the raw slot the value ends up in.
#
# Prerequisites: Foundry (forge / cast / anvil). Nothing else, and no network.
# Usage:  ./scripts/walkthrough-step0.zsh
#
# The private key below is anvil's first development account. It is printed in
# anvil's own banner and is public by design — never use it on a real network.

set -euo pipefail

readonly RPC="http://127.0.0.1:8545"
readonly DEV_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
readonly CONTRACT="src/learn/Step0Number.sol:Step0Number"

readonly ROOT="${0:A:h:h}"  # contracts/tictactoe
readonly REPO="${ROOT:h:h}"  # リポジトリの最上位（Next アプリ）
cd "$ROOT"

heading() { print -P "\n%F{cyan}── $1 ─────────────────────────────%f" }

anvil_pid=""
cleanup() { [[ -n "$anvil_pid" ]] && kill "$anvil_pid" 2>/dev/null || true }
trap cleanup EXIT INT TERM

if cast block-number --rpc-url "$RPC" >/dev/null 2>&1; then
  print "Using the chain already listening on $RPC"
else
  print "Starting a throwaway chain on $RPC"
  anvil --silent &
  anvil_pid=$!
  until cast block-number --rpc-url "$RPC" >/dev/null 2>&1; do sleep 0.2; done
fi

forge build >/dev/null 2>&1

heading "1. The interface the outside world sees"
print "Solidity generated the read-only 'number()' getter from the 'public' keyword."
forge inspect Step0Number abi

heading "2. Where the value physically lives"
print "One variable, slot 0, all 32 bytes of it."
forge inspect Step0Number storageLayout

heading "3. What it compiled to"
print "The first 24 instructions are the dispatcher: it reads the leading four"
print "bytes of the call and jumps to the matching function. Watch for the two"
print "PUSH4 values — those are the selectors from step 1."
forge inspect Step0Number deployedBytecode | cast disassemble | sed -n '19,36p'

heading "4. Deploying it"
local address
address=$(forge create "$CONTRACT" \
  --rpc-url "$RPC" --private-key "$DEV_KEY" --broadcast --json \
  | python3 -c 'import sys, json; print(json.load(sys.stdin)["deployedTo"])')
print "Live at $address"

heading "5. Reading (free, answered by one node, no transaction)"
cast call "$address" "number()(uint256)" --rpc-url "$RPC"

heading "6. The bytes a write actually puts on the wire"
print "Four bytes of selector, then the argument padded to 32 bytes:"
cast calldata "setNumber(uint256)" 42

heading "7. Writing (costs gas, mines a block)"
cast send "$address" "setNumber(uint256)" 42 \
  --rpc-url "$RPC" --private-key "$DEV_KEY" --json \
  | python3 -c 'import sys, json; d = json.load(sys.stdin); print("status", d["status"], " gas", int(d["gasUsed"], 16), " block", int(d["blockNumber"], 16))'

heading "8. Reading the raw slot, bypassing the getter entirely"
print "0x2a is 42. Storage is public: anyone can read it without asking the contract."
cast storage "$address" 0 --rpc-url "$RPC"

print -P "\n%F{green}Done.%f Try changing Step0Number.sol and running this again."
