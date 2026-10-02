#!/usr/bin/env zsh
# 「Sapphire を使うと何が違うか」をふつうの EVM の上で示す。
#   賃料を private のまま入れ、判定だけ返させる。
#   それでもストレージを直接読むと賃料が出てくる ── ここが Sapphire で変わる点。
set -euo pipefail
RPC=http://127.0.0.1:8545
PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
PROP=$(cast format-bytes32-string "PROP_A")
RENT=460000000            # 年間賃料 4.6 億円。目論見書では「非開示」の項目

ADDR=$(forge create src/ConfidentialRent.sol:ConfidentialRent \
        --rpc-url $RPC --private-key $PK --broadcast --json | jq -r .deployedTo)
print -r -- "配備: $ADDR"

cast send $ADDR "setRent(bytes32,uint256)" $PROP $RENT \
     --rpc-url $RPC --private-key $PK > /dev/null
print -r -- "賃料を private で登録した"
print -r -- ""

print -r -- "── 意図どおりに動く部分 ────────────────────────────"
print -r -- "借入 3 億円に対し賃料は足りるか (1.0倍以上を要求):"
cast call $ADDR "meetsCoverage(bytes32,uint256,uint256)(bool)" $PROP 300000000 10000 --rpc-url $RPC
print -r -- "借入 9 億円に対しては:"
cast call $ADDR "meetsCoverage(bytes32,uint256,uint256)(bool)" $PROP 900000000 10000 --rpc-url $RPC
print -r -- "  → 賃料そのものは返っていない。判定だけ。"
print -r -- ""

print -r -- "── ところが、ふつうの EVM では漏れる ──────────────"
# mapping の格納位置 = keccak256(key . slot)。curator は immutable でスロットを使わないので _annualRent は slot 0
SLOT=$(cast keccak $(cast concat-hex $PROP 0x0000000000000000000000000000000000000000000000000000000000000000))
RAW=$(cast storage $ADDR $SLOT --rpc-url $RPC)
print -r -- "ストレージを直接読む: $RAW"
print -r -- "10進に直すと: $(cast to-dec $RAW)"
print -r -- "  → 非開示のはずの賃料が、そのまま読める。private は隠蔽ではない。"
