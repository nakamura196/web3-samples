/**
 * ABI のエンコードとデコード。依存パッケージなし。
 * 符号化の本体は ndl-witness/lib/abi.mjs から持ってきた (cast と突き合わせ済み)。
 * セレクタとイベントだけ CorpusAnchor のものに差し替えてある。
 *
 * ── 可変長が入ると何が変わるか ─────────────────────────────────
 * 引数の並びが head と tail の 2 段になる。
 *
 *   固定長  … head にその値そのものを 32 バイトで置く
 *   可変長  … head には **tail の先頭までのオフセット**を置き、
 *             実体 (長さ 32 バイト + 中身を 32 の倍数に詰めたもの) を tail に置く
 *
 * verifyInclusion(bytes32 root, bytes entry, bytes32[] path, uint64 i, uint64 n) は
 * 可変長を 2 つ (entry と path) 持つので、この 2 段が両方で起きる。
 * 配列は「長さ 1 語 + 要素を並べたもの」で、要素が固定長なら tail は要らない。
 */

// cast sig / cast keccak で求めた値。Keccak-256 の実装を持たずに済ませるため定数で持つ
export const SIG = {
  anchor: '0xf0c537ef', // anchor(bytes32,bytes32,uint64,uint32,string,string)
  verifyInclusion: '0x80991ec8', // verifyInclusion(bytes32,bytes,bytes32[],uint64,uint64)
  leafHash: '0xac764322', // leafHash(bytes)
  nodeHash: '0x65cff470', // nodeHash(bytes32,bytes32)
};

export const TOPIC = {
  // CorpusAnchored(bytes32,bytes32,address,uint64,uint32,string,string)
  CorpusAnchored: '0x78a3a373a7264b1391050ae5764a99438d6f0c634915ba58c2be23634165d3ee',
};

const strip = (h) => String(h).replace(/^0x/, '');

/** 32 バイト右詰め。address も uint も bytes32 も bool もこの形に揃う */
export function word(v) {
  if (typeof v === 'boolean') return (v ? 1n : 0n).toString(16).padStart(64, '0');
  if (typeof v === 'bigint' || typeof v === 'number') return BigInt(v).toString(16).padStart(64, '0');
  if (Buffer.isBuffer(v)) return v.toString('hex').padStart(64, '0');
  return strip(v).toLowerCase().padStart(64, '0');
}

function splitTuple(type) {
  const inner = type.slice(1, -1);
  const parts = [];
  let depth = 0, buf = '';
  for (const ch of inner) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(buf); buf = ''; continue; }
    buf += ch;
  }
  if (buf) parts.push(buf);
  return parts;
}

/**
 * 型が配列なら [中身の型, 個数] を返す。個数が null なら可変長 T[]。
 *
 * ── ここで 2 度目につまずいた ──────────────────────────────────
 * `(address,uint8,bytes32,bytes32)[]` は **構造体の配列**であって構造体ではない。
 * `startsWith('(')` を先に見ると構造体と誤読して、`slice(1,-1)` で
 * `address,uint8,bytes32,bytes32)[` という壊れた文字列を切り出す。
 * それでも例外にならず、**4 語ぶんの undefined を並べた calldata** が出てくる。
 * 型を見分ける順番が「配列 → 構造体」でなければならない。
 */
function arrayOf(type) {
  const m = type.match(/^(.+)\[(\d*)\]$/);
  return m ? [m[1], m[2] === '' ? null : Number(m[2])] : null;
}

export function isDynamic(type) {
  if (type === 'string' || type === 'bytes') return true;
  const arr = arrayOf(type);
  if (arr) return arr[1] === null || isDynamic(arr[0]); // T[] は常に可変、T[k] は中身次第
  if (type.startsWith('(')) return splitTuple(type).some(isDynamic);
  return false;
}

/**
 * 固定長の型が head に占める語数。
 *
 * ── ここで一度つまずいた ────────────────────────────────────────
 * Ocean の `createNftWithErc20WithDispenser` の 3 番目の引数
 * `(address,uint256,uint256,bool,address)` は**可変長を含まない構造体**で、
 * head に 5 語をそのまま並べる (オフセットを置かない)。
 * ndl-witness から持ってきた符号化器はこれを 1 語と数えていたので、
 * 構造体を 32 バイトに押し込もうとして落ちた。
 * 「可変長かどうか」だけでは足りず、**固定長が何語ぶんか**も要る。
 */
export function staticWords(type) {
  const arr = arrayOf(type);
  if (arr) return staticWords(arr[0]) * arr[1];
  if (type.startsWith('(')) return splitTuple(type).reduce((n, t) => n + staticWords(t), 0);
  return 1;
}

/** 固定長の値を head にそのまま並べる形で符号化する */
function encodeStatic(type, value) {
  const arr = arrayOf(type);
  if (arr) return value.map((v) => encodeStatic(arr[0], v)).join('');
  if (type.startsWith('(')) return splitTuple(type).map((t, i) => encodeStatic(t, value[i])).join('');
  return word(value);
}

function encodeBytes(buf) {
  const hex = buf.toString('hex');
  const padded = hex.length % 64 === 0 ? hex : hex.padEnd(hex.length + (64 - (hex.length % 64)), '0');
  return word(BigInt(buf.length)) + padded;
}

function encodeDynamic(type, value) {
  if (type === 'string') return encodeBytes(Buffer.from(String(value), 'utf8'));
  if (type === 'bytes') {
    return encodeBytes(Buffer.isBuffer(value) ? value : Buffer.from(strip(value), 'hex'));
  }
  const arr = arrayOf(type); // 配列を先に見る (上の arrayOf のコメント)
  if (arr) {
    const body = encodeArgs(value.map(() => arr[0]), value);
    return arr[1] === null ? word(BigInt(value.length)) + body : body;
  }
  if (type.startsWith('(')) return encodeArgs(splitTuple(type), value);
  throw new Error(`未対応の可変長型: ${type}`);
}

/** head / tail の 2 段に分けて並べる */
export function encodeArgs(types, values) {
  const heads = [], tails = [];
  // 可変長は 1 語 (オフセット)、固定長は語数ぶん。構造体があると 1 引数 = 1 語ではない
  let tailOffset = types.reduce((n, t) => n + (isDynamic(t) ? 32 : staticWords(t) * 32), 0);
  types.forEach((t, i) => {
    if (isDynamic(t)) {
      heads.push(word(BigInt(tailOffset)));
      const enc = encodeDynamic(t, values[i]);
      tails.push(enc);
      tailOffset += enc.length / 2;
    } else {
      heads.push(encodeStatic(t, values[i]));
    }
  });
  return heads.join('') + tails.join('');
}

export const encodeCall = (selector, types, values) => selector + encodeArgs(types, values);

// ── デコード ────────────────────────────────────────────────────
export const topicToAddress = (t) => '0x' + strip(t).slice(24);

/** data 領域の n 番目の語 */
export const wordAt = (data, n) => '0x' + strip(data).slice(n * 64, (n + 1) * 64);

/** data 領域の n 番目の語がオフセットである string を取り出す */
export function stringAt(data, n) {
  const h = strip(data);
  const off = Number(BigInt('0x' + h.slice(n * 64, (n + 1) * 64))) * 2;
  const len = Number(BigInt('0x' + h.slice(off, off + 64)));
  return Buffer.from(h.slice(off + 64, off + 64 + len * 2), 'hex').toString('utf8');
}

/** data 領域の n 番目の語がオフセットである bytes を取り出す */
export function bytesAt(data, n) {
  const h = strip(data);
  const off = Number(BigInt('0x' + h.slice(n * 64, (n + 1) * 64))) * 2;
  const len = Number(BigInt('0x' + h.slice(off, off + 64)));
  return Buffer.from(h.slice(off + 64, off + 64 + len * 2), 'hex');
}

/** bool の戻り値 */
export const asBool = (hex) => BigInt(hex) === 1n;

/**
 * CorpusAnchored の復号。
 * indexed でない引数は data 領域に、宣言順で並ぶ:
 *   0: capturedAt (uint64) / 1: treeSize (uint32) / 2: sourceUri の位置 / 3: spec の位置
 */
export const decodeCorpusAnchored = (log) => ({
  corpusId: log.topics[1],
  root: log.topics[2],
  observer: topicToAddress(log.topics[3]),
  capturedAt: Number(BigInt(wordAt(log.data, 0))),
  treeSize: Number(BigInt(wordAt(log.data, 1))),
  sourceUri: stringAt(log.data, 2),
  spec: stringAt(log.data, 3),
  txHash: log.transactionHash,
  blockNumber: Number(BigInt(log.blockNumber)),
});
