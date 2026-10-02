/**
 * RLP (Recursive Length Prefix)。Ethereum がトランザクションを並べるときの符号化。
 *
 * ── なぜ要るのか ────────────────────────────────────────────────
 * ここまでこの試作は **一度も鍵を持っていない**。anvil に開錠済みのアカウントを
 * 用意させ、`eth_sendTransaction` で「これを送っておいて」と頼んでいた。署名は
 * anvil がやっていた (out/deployed.json の note に書いてあるとおり)。
 *
 * 公開チェーンにはその窓口が無い。**署名済みのバイト列を自分で組み立てて**
 * `eth_sendRawTransaction` に渡すしかない。その「バイト列の組み立て方」が RLP。
 *
 * ── ABI エンコードとは別物 ──────────────────────────────────────
 * lib/abi.mjs も「引数をバイト列にする」道具だが、**用途が違う**ので混ぜないこと。
 *
 *   ABI  コントラクトの関数に渡す引数。32 バイト単位に揃える。型がある
 *   RLP  トランザクションそのものの外側。詰めて書く。型が無い (バイト列と入れ子だけ)
 *
 * RLP が知っているのは「バイト列」と「リスト」の 2 つだけである。数値も文字列も
 * アドレスも、全部バイト列として渡す。**型を復元できない**ので、読む側は
 * 何番目が何なのかを知っていなければならない。
 *
 * ── 数の書き方に落とし穴がある ──────────────────────────────────
 * 数は **前ゼロを付けない最小のバイト列**で書く。そして **0 は空のバイト列**になる
 * (`0x00` ではない)。nonce が 0 のときにここを間違えると、署名は通るのに
 * ハッシュが変わるので、ノードが「署名者が違う」と言って弾く。原因が
 * 見えにくいので、toBytes() の分岐をここに閉じ込めてある。
 *
 * 逆に、アドレスや data は**そのままのバイト列**で、前ゼロを削ってはいけない。
 * 0x00ab… で始まるアドレスの先頭を削ると 19 バイトになって別の宛先になる。
 * だから「数として渡すもの」は BigInt で、「バイト列として渡すもの」は
 * Buffer か 0x 付き文字列で渡す、と呼び分けを決めている。
 *
 * 正しさは 00-selftest.mjs で、RLP の仕様に載っている公開値と突き合わせる。
 */

/** 数を「前ゼロなし・0 は空」の最小バイト列にする */
function minimalBytes(v) {
  let n = BigInt(v);
  if (n < 0n) throw new Error('RLP に負の数は書けない');
  if (n === 0n) return Buffer.alloc(0);           // ← 0x00 ではなく空
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  return Buffer.from(hex, 'hex');
}

/**
 * 入力を Buffer に正規化する。**ここが呼び分けの境界**。
 *
 *   bigint / number       数として扱う → 前ゼロを落とす
 *   '0x…' の文字列        バイト列として扱う → そのまま
 *   Buffer / Uint8Array   バイト列として扱う → そのまま
 *   null / undefined / '' 空のバイト列 (コントラクト作成の to など)
 */
export function toBytes(v) {
  if (v === null || v === undefined || v === '') return Buffer.alloc(0);
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v);
  if (typeof v === 'bigint' || typeof v === 'number') return minimalBytes(v);
  if (typeof v === 'string') {
    if (!v.startsWith('0x')) throw new Error(`0x の無い文字列は渡せない: ${v}`);
    const body = v.slice(2);
    if (body.length % 2) throw new Error(`16 進の桁が奇数: ${v}`);
    return Buffer.from(body, 'hex');
  }
  throw new Error(`RLP に渡せない型: ${typeof v}`);
}

/** 長さの前置き。short なら 1 バイト、long なら「長さの長さ」+ 長さ */
function lengthPrefix(len, offset) {
  if (len <= 55) return Buffer.from([offset + len]);
  const lenBytes = minimalBytes(len);
  return Buffer.concat([Buffer.from([offset + 55 + lenBytes.length]), lenBytes]);
}

/**
 * RLP エンコード。配列は入れ子のリストになる。
 *
 * バイト列 1 個で中身が 0x80 未満なら、前置きを付けずにそのまま置く。
 * この「1 バイトだけ特別扱い」があるので、空のバイト列 (0x80) と
 * 0x00 という 1 バイト (0x00) が別物になる。上の「0 は空」と繋がっている。
 */
export function encode(input) {
  if (Array.isArray(input)) {
    const payload = Buffer.concat(input.map(encode));
    return Buffer.concat([lengthPrefix(payload.length, 0xc0), payload]);
  }
  const bytes = toBytes(input);
  if (bytes.length === 1 && bytes[0] < 0x80) return bytes;
  return Buffer.concat([lengthPrefix(bytes.length, 0x80), bytes]);
}

/** 0x 付きで返す。RPC に渡す形 */
export const encodeHex = (input) => '0x' + encode(input).toString('hex');
