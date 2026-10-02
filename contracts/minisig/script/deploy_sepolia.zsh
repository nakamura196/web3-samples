#!/usr/bin/env zsh
# ---------------------------------------------------------------------------
# MiniSig を Base Sepolia (chain_id 84532) にデプロイし、2/3 の署名で実行する。
#
# 前提:
#   環境変数ファイルに使い捨ての鍵が入っていること。
#     OWNER1_ADDR / OWNER1_PK ... OWNER3_ADDR / OWNER3_PK
#   OWNER1 に Base Sepolia の ETH が入っていること（フォーセットから）。
#
# 使い方:
#   KEYS=/path/to/keys.env ./script/deploy_sepolia.zsh
#
# この鍵は testnet 専用の使い捨てである。本番では絶対に使わない。
# 本番では Foundry の暗号化キーストア (cast wallet import) を使うこと。
# ---------------------------------------------------------------------------
set -euo pipefail

RPC=${RPC:-https://sepolia.base.org}
KEYS=${KEYS:?KEYS に鍵ファイルのパスを指定してください}

source "$KEYS"

: ${OWNER1_ADDR:?}; : ${OWNER1_PK:?}
: ${OWNER2_ADDR:?}; : ${OWNER2_PK:?}
: ${OWNER3_ADDR:?}; : ${OWNER3_PK:?}

CHAIN=$(cast chain-id --rpc-url $RPC)
print "== Base Sepolia (chain_id=$CHAIN)"
print "  所有者1 (デプロイ兼務): $OWNER1_ADDR"
print "  所有者2                : $OWNER2_ADDR"
print "  所有者3                : $OWNER3_ADDR"

BAL=$(cast balance $OWNER1_ADDR --rpc-url $RPC --ether)
print "  所有者1 残高           : $BAL ETH"
if [[ $BAL == 0* && $BAL != 0.0[1-9]* ]]; then
  if [[ $(cast balance $OWNER1_ADDR --rpc-url $RPC) == "0" ]]; then
    print "\n!! 残高が 0 です。フォーセットで $OWNER1_ADDR に入金してください。"
    exit 1
  fi
fi

# ---------------------------------------------------------------- 1. deploy
print "\n== 1. デプロイ (閾値 2/3)"
# --constructor-args は可変長引数。--json は必ずその前に置く。
OUT=$(forge create src/MiniSig.sol:MiniSig \
  --rpc-url $RPC --private-key $OWNER1_PK --broadcast --json \
  --constructor-args "[$OWNER1_ADDR,$OWNER2_ADDR,$OWNER3_ADDR]" 2)
SIG=$(print $OUT | python3 -c 'import sys,json; print(json.load(sys.stdin)["deployedTo"])')
DTX=$(print $OUT | python3 -c 'import sys,json; print(json.load(sys.stdin)["transactionHash"])')
print "  MiniSig : $SIG"
print "  tx      : $DTX"
print "  確認    : https://sepolia.basescan.org/address/$SIG"

# ------------------------------------------------------------------ 2. fund
print "\n== 2. MiniSig に 0.002 ETH を入金"
cast send $SIG --value 0.002ether --rpc-url $RPC --private-key $OWNER1_PK >/dev/null
print "  残高: $(cast balance $SIG --rpc-url $RPC --ether) ETH"

# ------------------------------------------------------------- 3. hash+sign
VALUE=$(cast to-wei 0.001 ether)
RECIPIENT=$OWNER3_ADDR
NONCE=$(cast call $SIG "nonce()(uint256)" --rpc-url $RPC)

print "\n== 3. 取引ハッシュ (宛先=所有者3, 0.001 ETH, nonce=$NONCE)"
TXHASH=$(cast call $SIG "txHash(address,uint256,bytes,uint256)(bytes32)" \
  $RECIPIENT $VALUE 0x $NONCE --rpc-url $RPC)
print "  txHash: $TXHASH"

print "\n== 4. 所有者1と2が署名"
S1=$(cast wallet sign --private-key $OWNER1_PK $TXHASH)
S2=$(cast wallet sign --private-key $OWNER2_PK $TXHASH)

A1=$(print $OWNER1_ADDR | tr 'A-Z' 'a-z')
A2=$(print $OWNER2_ADDR | tr 'A-Z' 'a-z')
if [[ $A1 < $A2 ]]; then SIGS="${S1}${S2:2}"; print "  順序: 1 -> 2"
else                     SIGS="${S2}${S1:2}"; print "  順序: 2 -> 1"; fi

# --------------------------------------------------------------- 5. execute
print "\n== 5. execTransaction"
ETX=$(cast send $SIG "execTransaction(address,uint256,bytes,bytes)" \
  $RECIPIENT $VALUE 0x $SIGS \
  --rpc-url $RPC --private-key $OWNER1_PK --json \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["transactionHash"])')
print "  tx     : $ETX"
print "  確認   : https://sepolia.basescan.org/tx/$ETX"

# ---------------------------------------------------------------- 6. verify
print "\n== 6. 確認"
print "  MiniSig 残高 : $(cast balance $SIG --rpc-url $RPC --ether) ETH"
print "  所有者3 残高 : $(cast balance $OWNER3_ADDR --rpc-url $RPC --ether) ETH"
print "  nonce        : $(cast call $SIG 'nonce()(uint256)' --rpc-url $RPC)"

print "\n完了"
print "  コントラクト: https://sepolia.basescan.org/address/$SIG"
