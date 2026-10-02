#!/usr/bin/env zsh
#
# deploy-testnet.zsh — deploy both contracts to a public testnet.
#
# The private key never leaves the encrypted keystore at ~/.foundry/keystores,
# and the password that unlocks it lives in 1Password. Neither is ever printed
# or written anywhere in the clear: the password is copied into a mode-0600
# temporary file only for as long as forge needs to read it, because forge
# insists on a real file path rather than a pipe.
#
# Prerequisites
#   1. A 1Password item holding the keystore password (see PASSWORD_REF below)
#   2. A keystore created with that password:
#        CAST_PASSWORD="$(op read "$PASSWORD_REF")" \
#          cast wallet new ~/.foundry/keystores deployer-base-sepolia
#   3. Test ether at that address, from a faucet
#
# Usage:  ./scripts/deploy-testnet.zsh [account-name] [chain]
#           account-name  keystore name (default: deployer-base-sepolia)
#           chain         base_sepolia | sepolia (default: base_sepolia)
#
# Verification uses Sourcify, which needs no API key. To publish to Basescan
# instead, set ETHERSCAN_API_KEY and pass --verifier etherscan by hand.

set -euo pipefail

readonly ACCOUNT="${1:-deployer-base-sepolia}"
readonly CHAIN="${2:-base_sepolia}"
readonly ROOT="${0:A:h:h}"  # contracts/tictactoe
readonly REPO="${ROOT:h:h}"  # リポジトリの最上位（Next アプリ）
readonly PASSWORD_REF="op://Personal/tictactoe base sepolia deployer/password"

# forge wants a file it can stat, so a pipe will not do. Keep it short-lived and
# unreadable to anyone else, and remove it however the script exits.
pw_file=""
cleanup() { [[ -n "$pw_file" ]] && rm -f "$pw_file" }
trap cleanup EXIT INT TERM

unlock() {
  pw_file=$(mktemp)
  chmod 600 "$pw_file"
  op read "$PASSWORD_REF" | tr -d '\n' > "$pw_file"
}

case "$CHAIN" in
  base_sepolia) readonly CHAIN_ID=84532;  readonly RPC="https://sepolia.base.org" ;;
  sepolia)      readonly CHAIN_ID=11155111; readonly RPC="https://ethereum-sepolia-rpc.publicnode.com" ;;
  *) print -u2 "Unknown chain: $CHAIN (expected base_sepolia or sepolia)"; exit 1 ;;
esac

step() { print -P "\n%F{cyan}▸ $1%f" }

if [[ ! -f "$HOME/.foundry/keystores/$ACCOUNT" ]]; then
  print -u2 "No keystore named '$ACCOUNT'. Create one with:"
  print -u2 "  cast wallet new ~/.foundry/keystores $ACCOUNT"
  exit 1
fi

unlock

step "Deployer"
local deployer
deployer=$(cast wallet address --account "$ACCOUNT" --password-file "$pw_file")
print "  $deployer"

local balance
balance=$(cast balance "$deployer" --rpc-url "$RPC")
print "  balance: $(cast from-wei "$balance") ETH on $CHAIN ($CHAIN_ID)"

if [[ "$balance" == "0" ]]; then
  print -u2 "\nThat address has no ether, so it cannot pay for gas."
  print -u2 "Fund it from a faucet, then run this again."
  print -u2 ""
  print -u2 "  Sepolia, no account or phone number needed — mine in the browser:"
  print -u2 "    https://sepolia-faucet.pk910.de"
  print -u2 ""
  print -u2 "  Others ask you to register first:"
  print -u2 "    Base Sepolia  https://portal.cdp.coinbase.com/products/faucet   (phone)"
  print -u2 "    Base Sepolia  https://www.alchemy.com/faucets/base-sepolia      (mainnet balance)"
  print -u2 "    Sepolia       https://cloud.google.com/application/web3/faucet/ethereum/sepolia"
  print -u2 ""
  print -u2 "  Already hold Sepolia ether and want the faster L2? Bridge it:"
  print -u2 "    https://superbridge.app"
  exit 1
fi

step "Running the test suite before spending anything"
cd "$ROOT"
forge test --summary

step "Deploying"
local start_block deploy_log
start_block=$(cast block-number --rpc-url "$RPC")
# A predictable path in a world-writable directory invites symlink games, and a
# second run would clobber the first. mktemp costs nothing.
deploy_log=$(mktemp)

# Broadcast first, verify after. Verification talks to a third-party service
# and can fail for reasons that have nothing to do with the deployment; letting
# it abort the run here would leave deployed contracts with no recorded address.
forge script script/Deploy.s.sol \
  --rpc-url "$RPC" \
  --account "$ACCOUNT" --password-file "$pw_file" \
  --broadcast \
  | tee "$deploy_log"

local pvp solo
pvp=$(grep -oE "NEXT_PUBLIC_TICTACTOE_ADDRESS_${CHAIN_ID}=0x[0-9a-fA-F]{40}" $deploy_log | tail -1 | cut -d= -f2)
solo=$(grep -oE "NEXT_PUBLIC_SOLO_ADDRESS_${CHAIN_ID}=0x[0-9a-fA-F]{40}" $deploy_log | tail -1 | cut -d= -f2)

if [[ -z "$pvp" || -z "$solo" ]]; then
  print -u2 "\nCould not find the deployed addresses in the output. See $deploy_log"
  exit 1
fi

step "Deployed"
print "  TicTacToe:     $pvp"
print "  SoloTicTacToe: $solo"
print "  from block:    $start_block"

# Recorded so the frontend's event queries do not have to scan from genesis,
# which public RPC endpoints refuse for wide ranges.
local out="$ROOT/deployments/$CHAIN_ID.env"
mkdir -p "$ROOT/deployments"
cat > "$out" <<ENV
# Written by scripts/deploy-testnet.zsh. Addresses are public; safe to commit.
NEXT_PUBLIC_TICTACTOE_ADDRESS_${CHAIN_ID}=$pvp
NEXT_PUBLIC_SOLO_ADDRESS_${CHAIN_ID}=$solo
NEXT_PUBLIC_DEPLOY_BLOCK_${CHAIN_ID}=$start_block
ENV

print "\nSaved to $out"

step "Verifying the source (best effort)"
verify() {
  local address="$1" name="$2"
  # An exported ETHERSCAN_API_KEY makes forge switch to the Etherscan verifier
  # even with --verifier sourcify, so strip it for this call.
  if env -u ETHERSCAN_API_KEY forge verify-contract "$address" "$name" \
       --chain-id "$CHAIN_ID" --verifier sourcify --watch >/dev/null 2>&1; then
    print "  $name verified on Sourcify"
  else
    print "  $name could not be verified automatically."
    print "    Retry later:  forge verify-contract $address $name --chain-id $CHAIN_ID --verifier sourcify"
    print "    For Basescan's Read/Write tabs, set ETHERSCAN_API_KEY and use --verifier etherscan."
  fi
}
verify "$pvp" "src/TicTacToe.sol:TicTacToe"
verify "$solo" "src/SoloTicTacToe.sol:SoloTicTacToe"
print -P "\n%F{green}Done.%f Next: .env.production の値を更新し、最上位で npm run deploy"
