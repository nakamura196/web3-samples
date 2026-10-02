#!/usr/bin/env zsh
#
# fund.zsh — send test ether to an address on the local Anvil chain.
#
# Anvil's own accounts start with 10,000 ETH, but your everyday MetaMask address
# starts at zero, and a zero balance cannot even pay gas.
#
# This sends a real transfer rather than using the `anvil_setBalance` cheat code.
# setBalance edits state without mining a block, and wallets only refresh their
# cached balance when they see a new block — so the wallet sits there showing
# zero and refusing to send anything while the chain says otherwise. A plain
# transfer mines a block and avoids that whole class of confusion.
#
# Usage:  ./scripts/fund.zsh 0xYourAddress [amountEth]     # default 100

set -euo pipefail

readonly RPC="http://127.0.0.1:8545"
readonly ADDRESS="${1:-}"
readonly AMOUNT="${2:-100}"

# anvil's first development account, holding 10,000 ETH. Public by design.
readonly FAUCET_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

if [[ -z "$ADDRESS" ]]; then
  print -u2 "usage: $0 <address> [amountEth]"
  exit 1
fi

if [[ ! "$ADDRESS" =~ '^0x[0-9a-fA-F]{40}$' ]]; then
  print -u2 "Not an address: $ADDRESS"
  exit 1
fi

if ! cast block-number --rpc-url "$RPC" >/dev/null 2>&1; then
  print -u2 "No chain on $RPC. Start one with ./scripts/dev-up.zsh first."
  exit 1
fi

cast send "$ADDRESS" --value "${AMOUNT}ether" \
  --private-key "$FAUCET_KEY" --rpc-url "$RPC" >/dev/null

print "$ADDRESS now holds $(cast balance "$ADDRESS" --rpc-url "$RPC" --ether) ETH."
print "Sent as a real transaction, mined in block $(cast block-number --rpc-url "$RPC") — wallets will pick it up."
