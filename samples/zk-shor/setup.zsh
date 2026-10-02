#!/usr/bin/env zsh
#
# zk-shor のローカル環境を作る。
#
# 前提 : Python 3.10 以降 (numpy が必要なので、numpy が入る処理系を選ぶ)
# 使い方: ./setup.zsh
# 何をするか:
#   1. .venv を作る (システムの site-packages を継承 = ネットワーク不要)
#   2. numpy が読めるか確認し、無ければ pip で入れる
#   3. zkshor を editable install する
#   4. テストを流して、最後に状態を表示する
#
# 秘密情報は一切扱わない。生成する鍵はすべてその場限りの玩具である。

set -euo pipefail

cd "${0:A:h}"

PY=""
for cand in python3.13 python3.12 python3.11 python3; do
  if command -v $cand >/dev/null 2>&1 && $cand -c 'import numpy' >/dev/null 2>&1; then
    PY=$cand
    break
  fi
done

if [[ -z "$PY" ]]; then
  print -u2 "numpy が入っている python3 が見つからない。"
  print -u2 "  brew install python@3.13 && python3.13 -m pip install numpy"
  exit 1
fi

print "使う処理系: $($PY -V) ($(command -v $PY))"

if [[ ! -d .venv ]]; then
  $PY -m venv --system-site-packages .venv
  print ".venv を作成"
fi

source .venv/bin/activate
python -c 'import numpy; print("numpy", numpy.__version__)'
python -m pip install -q -e . 2>/dev/null || python -m pip install -q -e . --no-build-isolation
print "zkshor を editable install"

python -m unittest discover -s tests -t . -q

print ""
print "----------------------------------------------------------------"
print "準備完了。"
print ""
print "  source .venv/bin/activate"
print "  zkshor all          # 全部通す"
print "  zkshor shor --peaks # Shor で秘密鍵を取り出すところだけ"
print "----------------------------------------------------------------"
