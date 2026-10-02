#!/usr/bin/env zsh
# 同じ契約を「ふつうの EVM」と「秘匿 EVM」の両方に置き、
# 非開示のはずの賃料が読めるかどうかを比べる。
#
#   使い方
#     zsh verify_confidential.zsh anvil             ← ローカル(漏れるはず)
#     zsh verify_confidential.zsh sapphire         ← Sapphire Testnet(止まるはず)
#
#   秘密鍵は 1Password から読む。ディスクにも履歴にも残さない。
set -euo pipefail

TARGET=${1:-anvil}
case $TARGET in
  anvil)
    RPC=http://127.0.0.1:8545
    PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80  # anvil の既定鍵。公開値
    LABEL="ふつうの EVM (anvil)" ;;
  sapphire)
    RPC=https://testnet.sapphire.oasis.io
    PK=$(op read "op://Personal/Sapphire Testnet/private_key")
    LABEL="秘匿 EVM (Oasis Sapphire Testnet, chain 23295)" ;;
  *) print "anvil か sapphire を指定してください"; exit 1 ;;
esac

PROP=$(cast format-bytes32-string "PROP_A")
RENT=460000000

print -r -- "=== $LABEL ==="
ADDR=$(forge create src/ConfidentialRent.sol:ConfidentialRent \
        --rpc-url $RPC --private-key $PK --broadcast --json | jq -r .deployedTo)
print -r -- "配備: $ADDR"

cast send $ADDR "setRent(bytes32,uint256)" $PROP $RENT --rpc-url $RPC --private-key $PK > /dev/null
print -r -- "非開示の賃料 ${RENT} を private で登録"

print -r -- ""
print -r -- "判定は動くか (借入3億に対し賃料は足りるか):"
cast call $ADDR "meetsCoverage(bytes32,uint256,uint256)(bool)" $PROP 300000000 10000 --rpc-url $RPC

print -r -- ""
print -r -- "ストレージを直接読むと:"
SLOT=$(cast keccak $(cast concat-hex $PROP 0x0000000000000000000000000000000000000000000000000000000000000000))
RAW=$(cast storage $ADDR $SLOT --rpc-url $RPC 2>&1 || true)
print -r -- "  raw = $RAW"
if [[ "$RAW" == 0x* ]]; then
  DEC=$(cast to-dec $RAW 2>/dev/null || echo "-")
  if [[ "$DEC" == "$RENT" ]]; then
    print -r -- "  → ★ 賃料がそのまま読めた。private は隠蔽ではない"
  else
    print -r -- "  → 賃料は出てこなかった (10進: $DEC)"
  fi
else
  print -r -- "  → ストレージを読めなかった。秘匿が効いている"
fi
unset PK
