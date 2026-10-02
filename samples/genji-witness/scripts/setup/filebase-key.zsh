#!/usr/bin/env zsh
#
# Filebase の Access Key / Secret Key を 1Password に入れ、.env.local に op:// 参照を足す。
#
#   前提   op にサインインしていること / Filebase でバケットと鍵を作ってあること
#   使い方 zsh scripts/setup/filebase-key.zsh
#   環境   VAULT / TITLE / BUCKET で変えられる
#
# 入力は伏せ字で受け取り、標準入力経由で 1Password に渡す。
# 端末にもシェル履歴にも argv にも値が残らない。
#
set -euo pipefail

HERE="${0:A:h}"
ROOT="${HERE:h:h}"
VAULT="${VAULT:-Personal}"
TITLE="${TITLE:-genji-witness filebase}"
BUCKET="${BUCKET:-genji-witness}"

if ! op whoami >/dev/null 2>&1; then
  print -u2 -- "op にサインインしていません。先に 'eval \$(op signin)' を実行してください。"
  exit 1
fi

if op item get "$TITLE" --vault="$VAULT" >/dev/null 2>&1; then
  print -u2 -- "'$TITLE' は既に $VAULT にあります。入れ直すなら先に消すか TITLE を変えてください。"
  exit 1
fi

print -- "Filebase の鍵を $VAULT に入れます (bucket: $BUCKET)"
print -- "https://console.filebase.com/keys で発行した値を貼ってください。画面には出ません。"
print -- ""

read -s 'FB_KEY?  Access Key : '
print -- ""
read -s 'FB_SECRET?  Secret Key : '
print -- ""

if [[ -z "$FB_KEY" || -z "$FB_SECRET" ]]; then
  print -u2 -- "どちらかが空です。やり直してください。"
  exit 1
fi

print -- ""
print -- "1Password に入れます"
print -r -- "$FB_KEY
$FB_SECRET" | node "$ROOT/scripts/setup/new-filebase.mjs" "$BUCKET" "$TITLE" | op item create --vault="$VAULT" - >/dev/null
print -- "  入れました: op://$VAULT/$TITLE/secret_key"

print -- ""
print -- "読み戻して突き合わせます"
if [[ "$(op read "op://$VAULT/$TITLE/access_key")" != "$FB_KEY" ]]; then
  print -u2 -- "  access_key が一致しません。"
  exit 1
fi
if [[ "$(op read "op://$VAULT/$TITLE/secret_key")" != "$FB_SECRET" ]]; then
  print -u2 -- "  secret_key が一致しません。"
  exit 1
fi
print -- "  どちらも一致しました (値は表示していません)"

unset FB_KEY FB_SECRET

if grep -q FILEBASE_KEY "$ROOT/.env.local" 2>/dev/null; then
  print -- ""
  print -- ".env.local には既に FILEBASE_* があります。書き換えていません。"
else
  cat >> "$ROOT/.env.local" <<ENVEOF

# IPFS (Filebase)。**ここに上げたものは後から消せます。**
FILEBASE_KEY=op://$VAULT/$TITLE/access_key
FILEBASE_SECRET=op://$VAULT/$TITLE/secret_key
# bucket は秘密ではない。op:// にすると op run が出力中の同じ文字列を
# すべて伏せ字にしてしまい、ファイルパスまで <concealed by 1Password> になる
FILEBASE_BUCKET=$BUCKET
ENVEOF
  print -- ""
  print -- ".env.local に op:// 参照を足しました"
fi

print -- ""
print -- "次に、これを実行してください"
print -- "  op run --env-file=.env.local -- node scripts/08-ipfs.mjs --upload"
