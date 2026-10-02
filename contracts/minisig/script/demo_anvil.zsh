#!/usr/bin/env zsh
# ---------------------------------------------------------------------------
# MiniSig を anvil 上で動かす一連の流れ。
#
# 前提: 別の端末で `anvil --port 8555` が起動している
# 使い方: ./script/demo_anvil.zsh    (別ポートなら RPC=http://... ./script/demo_anvil.zsh)
#
# やること:
#   1. 所有者3人・閾値2 で MiniSig をデプロイ
#   2. 1 ETH を入れる
#   3. 「受取人へ 0.4 ETH 送る」取引のハッシュを contract から取得
#   4. 所有者2人がそれぞれ署名する（鍵はどこにも送られない）
#   5. 署名をアドレス昇順に連結して execTransaction を呼ぶ
#   6. 残高が動いたことを確認する
#
# anvil が公開しているテスト用の鍵しか使わない。本物の鍵は一切登場しない。
# ---------------------------------------------------------------------------
set -euo pipefail

RPC=${RPC:-http://127.0.0.1:8555}

# anvil の既定アカウント（決定論的。公開されている偽の鍵）
DEPLOYER_PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
OWNER1_PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
OWNER2_PK=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
OWNER3_PK=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a

OWNER1=$(cast wallet address --private-key $OWNER1_PK)
OWNER2=$(cast wallet address --private-key $OWNER2_PK)
OWNER3=$(cast wallet address --private-key $OWNER3_PK)
RECIPIENT=0x000000000000000000000000000000000000dEaD

print "== 所有者"
print "  1: $OWNER1"
print "  2: $OWNER2"
print "  3: $OWNER3"

# ---------------------------------------------------------------- 1. deploy
print "\n== 1. デプロイ (閾値 2/3)"
# 注意: --constructor-args は可変長引数なので、後ろに他のフラグを置くと
#       それごと引数として飲み込まれる。--json は必ず前に置く。
SIG=$(forge create src/MiniSig.sol:MiniSig \
  --rpc-url $RPC --private-key $DEPLOYER_PK --broadcast --json \
  --constructor-args "[$OWNER1,$OWNER2,$OWNER3]" 2 \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["deployedTo"])')
print "  MiniSig: $SIG"

# ------------------------------------------------------------------ 2. fund
print "\n== 2. 1 ETH を入金"
cast send $SIG --value 1ether --rpc-url $RPC --private-key $DEPLOYER_PK >/dev/null
print "  残高: $(cast balance $SIG --rpc-url $RPC --ether) ETH"

# ------------------------------------------------------------------ 3. hash
VALUE=$(cast to-wei 0.4 ether)
NONCE=$(cast call $SIG "nonce()(uint256)" --rpc-url $RPC)
print "\n== 3. 取引ハッシュを contract から取得 (nonce=$NONCE)"
TXHASH=$(cast call $SIG "txHash(address,uint256,bytes,uint256)(bytes32)" \
  $RECIPIENT $VALUE 0x $NONCE --rpc-url $RPC)
print "  txHash: $TXHASH"

# ------------------------------------------------------------------ 4. sign
print "\n== 4. 所有者1と2が署名"
SIG1=$(cast wallet sign --private-key $OWNER1_PK $TXHASH)
SIG2=$(cast wallet sign --private-key $OWNER2_PK $TXHASH)
print "  owner1: $SIG1"
print "  owner2: $SIG2"

# 署名者アドレスの昇順に並べる（contract が重複排除のために要求する）
O1L=$(print $OWNER1 | tr 'A-Z' 'a-z')
O2L=$(print $OWNER2 | tr 'A-Z' 'a-z')
if [[ $O1L < $O2L ]]; then
  SIGS="${SIG1}${SIG2:2}"
  print "  順序: owner1 -> owner2"
else
  SIGS="${SIG2}${SIG1:2}"
  print "  順序: owner2 -> owner1"
fi

# --------------------------------------------------------------- 5. execute
print "\n== 5. execTransaction を実行"
cast send $SIG "execTransaction(address,uint256,bytes,bytes)" \
  $RECIPIENT $VALUE 0x $SIGS \
  --rpc-url $RPC --private-key $DEPLOYER_PK >/dev/null
print "  実行された"

# ---------------------------------------------------------------- 6. verify
print "\n== 6. 確認"
print "  MiniSig 残高 : $(cast balance $SIG --rpc-url $RPC --ether) ETH"
print "  受取人 残高  : $(cast balance $RECIPIENT --rpc-url $RPC --ether) ETH"
print "  nonce        : $(cast call $SIG 'nonce()(uint256)' --rpc-url $RPC)"

# ------------------------------------------------- 7. 1本だけでは通らないこと
print "\n== 7. 署名1本だけで試す（失敗するはず）"
NONCE2=$(cast call $SIG "nonce()(uint256)" --rpc-url $RPC)
TXHASH2=$(cast call $SIG "txHash(address,uint256,bytes,uint256)(bytes32)" \
  $RECIPIENT $VALUE 0x $NONCE2 --rpc-url $RPC)
ONE=$(cast wallet sign --private-key $OWNER1_PK $TXHASH2)
if cast call $SIG "execTransaction(address,uint256,bytes,bytes)" \
     $RECIPIENT $VALUE 0x $ONE --rpc-url $RPC 2>/dev/null; then
  print "  !! 通ってしまった。契約に欠陥がある"
  exit 1
else
  print "  想定どおり拒否された (TooFewSignatures)"
fi

print "\n完了。デプロイ先: $SIG"
