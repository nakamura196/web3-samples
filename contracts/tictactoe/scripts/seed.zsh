#!/usr/bin/env zsh
#
# seed.zsh — put a few games on the local chain so the lobby is not empty.
#
# Reads the deployed addresses out of web/.env.local, so it always targets the
# contracts the frontend is actually pointed at. Run it after dev-up.zsh.
#
# Usage:  ./scripts/seed.zsh [addressToFund]
#   Passing your own MetaMask address also tops it up with test ether, so you
#   can play with the wallet you already use instead of importing a dev key.

set -euo pipefail

readonly RPC="http://127.0.0.1:8545"
readonly ROOT="${0:A:h:h}"  # contracts/tictactoe
readonly REPO="${ROOT:h:h}"  # リポジトリの最上位（Next アプリ）
readonly ENV_FILE="$REPO/.env.local"
readonly ZERO="0x0000000000000000000000000000000000000000"

# anvil's first two development accounts. Public by design; never use them for real.
readonly KEY_A="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
readonly KEY_B="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"

[[ -f "$ENV_FILE" ]] || { print -u2 "No $ENV_FILE. Run ./scripts/dev-up.zsh first."; exit 1 }

local pvp
pvp=$(grep '^NEXT_PUBLIC_TICTACTOE_ADDRESS_31337=' "$ENV_FILE" | cut -d= -f2)
[[ -n "$pvp" ]] || { print -u2 "No local TicTacToe address in $ENV_FILE."; exit 1 }

cast code "$pvp" --rpc-url "$RPC" | grep -q '^0x.' \
  || { print -u2 "Nothing deployed at $pvp. The chain and .env.local disagree — rerun dev-up.zsh."; exit 1 }

print "Seeding $pvp"
send() { cast send "$@" --rpc-url "$RPC" >/dev/null }

# An open game anyone can join.
send "$pvp" "createGame(address,uint32)" "$ZERO" 3600 --value 0.1ether --private-key "$KEY_A"

# A game in progress, waiting on account A.
send "$pvp" "createGame(address,uint32)" "$ZERO" 3600 --value 0.05ether --private-key "$KEY_B"
send "$pvp" "joinGame(uint256)" 1 --value 0.05ether --private-key "$KEY_A"
send "$pvp" "play(uint256,uint8)" 1 4 --private-key "$KEY_B"

# A finished game: account A takes the top row and the whole pot.
send "$pvp" "createGame(address,uint32)" "$ZERO" 3600 --value 0.2ether --private-key "$KEY_A"
send "$pvp" "joinGame(uint256)" 2 --value 0.2ether --private-key "$KEY_B"
local cells=(0 3 1 4 2)
local keys=("$KEY_A" "$KEY_B" "$KEY_A" "$KEY_B" "$KEY_A")
for i in {1..5}; do
  send "$pvp" "play(uint256,uint8)" 2 "${cells[$i]}" --private-key "${keys[$i]}"
done

print "  #0 open (0.1 ETH)"
print "  #1 in progress (0.05 ETH each)"
print "  #2 finished — 0.4 ETH waiting to be withdrawn by $(cast wallet address --private-key "$KEY_A")"

if [[ -n "${1:-}" ]]; then
  "$ROOT/scripts/fund.zsh" "$1" 100
fi
