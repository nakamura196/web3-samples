#!/usr/bin/env zsh
#
# Sepolia 用の鍵を作り、1Password に入れて、.env.local に op:// 参照を書く。
#
#   前提   op にサインインしていること (op signin)
#   使い方 zsh scripts/setup/testnet-key.zsh
#   環境   VAULT / TITLE で入れ先を変えられる
#
# やること
#   1. 鍵をその場で作る (node)。**ディスクにも argv にも置かない**
#   2. 標準入力経由で 1Password に入れる (op item create -)
#   3. 読み戻して、同じアドレスが出るか突き合わせる
#   4. .env.local に op:// 参照だけを書く (秘密の実値は書かない)
#
# 作った鍵には**まだ残高がありません**。faucet から Sepolia ETH を入れてください。
#
set -euo pipefail

HERE="${0:A:h}"
ROOT="${HERE:h:h}"
VAULT="${VAULT:-Personal}"
TITLE="${TITLE:-genji-witness sepolia}"

print -- "1Password の状態を確かめます"
if ! op whoami >/dev/null 2>&1; then
  print -u2 -- "  op にサインインしていません。先に 'op signin' を実行してください。"
  exit 1
fi
print -- "  サインイン済み: $(op whoami --format=json | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).url))')"

if op item get "$TITLE" --vault="$VAULT" >/dev/null 2>&1; then
  print -u2 -- "  '$TITLE' は既に $VAULT にあります。作り直すなら先に消すか TITLE を変えてください。"
  exit 1
fi

print -- ""
print -- "鍵を作って $VAULT に入れます (秘密鍵は端末に出ません)"
node "$ROOT/scripts/setup/new-key.mjs" "$TITLE" | op item create --vault="$VAULT" - >/dev/null
print -- "  入れました: op://$VAULT/$TITLE/private_key"

print -- ""
print -- "読み戻して突き合わせます"
STORED_ADDR="$(op read "op://$VAULT/$TITLE/address")"
DERIVED_ADDR="$(op read "op://$VAULT/$TITLE/private_key" | node -e '
  let d="";process.stdin.on("data",c=>d+=c).on("end",async()=>{
    const {addressOf}=await import(process.argv[1]+"/lib/tx.mjs");
    console.log(addressOf(d.trim()));
  });' "$ROOT")"
if [[ "$STORED_ADDR" != "$DERIVED_ADDR" ]]; then
  print -u2 -- "  一致しません。保存 $STORED_ADDR / 導出 $DERIVED_ADDR"
  exit 1
fi
print -- "  一致しました: $DERIVED_ADDR"

print -- ""
print -- ".env.local を書きます (op:// 参照だけ)"
cat > "$ROOT/.env.local" <<ENVEOF
# genji-witness — ローカル開発用。**実値は書かない。**
# 使い方: op run --env-file=.env.local -- node scripts/07-sepolia.mjs
SEPOLIA_PRIVATE_KEY=op://$VAULT/$TITLE/private_key
# アドレスは公開情報。op:// にすると op run が出力中の同じ文字列を全部伏せ字にする
SEPOLIA_ADDRESS=$DERIVED_ADDR
ENVEOF
print -- "  書きました: $ROOT/.env.local (.gitignore 済み)"

print -- ""
print -- "残っていること"
print -- "  faucet から Sepolia ETH を入れてください (0.05 ETH もあれば足ります)"
print -- "    https://www.alchemy.com/faucets/ethereum-sepolia"
print -- "    https://sepolia-faucet.pk910.de/"
print -- "  宛先  $DERIVED_ADDR"
print -- "  確認  https://sepolia.etherscan.io/address/$DERIVED_ADDR"

unset STORED_ADDR DERIVED_ADDR
