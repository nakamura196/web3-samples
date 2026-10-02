/**
 * IPFS のコンテンツ識別子 (CID) を、依存パッケージなしで算出する。
 *
 * ndl-witness の cid.mjs は 256 KiB 以下の単一ブロック (CIDv1 / raw) だけを扱い、
 * それを超える場合は「UnixFS の DAG が要る (この試作は未対応)」と例外を投げていた。
 * **校異源氏物語ではそこに当たる。** 54 帖のうち 4 帖が 256 KiB を超える
 * (最大 309,169 バイト)。なので DAG を組む側をここで書いた。
 *
 * ── 256 KiB を超えると何が起きるか ──────────────────────────────
 * ファイルは 256 KiB ごとのチャンクに切られ、それぞれが 1 ブロックになる。
 * CID はチャンクを束ねる**中間ノードのハッシュ**になるので、
 * ファイル全体の SHA-256 とは一致しない。つまり
 *
 *   309,169 バイトのファイル → チャンク 2 個 → dag-pb ノード 1 個 → その CID
 *
 * ── dag-pb の構造 (protobuf) ────────────────────────────────────
 *   message PBLink { bytes Hash = 1; string Name = 2; uint64 Tsize = 3; }
 *   message PBNode { repeated PBLink Links = 2; bytes Data = 1; }
 *
 * **PBNode は Links (フィールド 2) を Data (フィールド 1) より先に書く。**
 * 番号順に並べないのは dag-pb の仕様がそう決めているためで、
 * 素直にフィールド番号順に書くと違う CID が出る。ここが一番間違えるところ。
 *
 * Data には UnixFS のメッセージが入る:
 *   message Data { DataType Type = 1; bytes Data = 2; uint64 filesize = 3;
 *                  repeated uint64 blocksizes = 4; }
 *   Type: Raw=0, Directory=1, File=2
 *
 * ── どこまで検証したか ──────────────────────────────────────────
 * scripts/00-selftest.mjs で、公開されている 2 つの値と突き合わせている:
 *
 *   空のディレクトリ QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn
 *   空のファイル     QmbFMke1KXqnYyBBWxB74N4c5SBnJMVAiMNRcGu6x1AwQH
 *
 * これで protobuf の符号化・フィールドの並び・UnixFS の Data・CID の組み立ては
 * 検証できる。**検証できていないのは複数チャンクを繋ぐ Links の部分**で、
 * 手元に ipfs のコマンドが無いため照合できていない (README に明記した)。
 * 実際に IPFS へ載せる段では `ipfs add --cid-version=1 --raw-leaves` の出力と
 * 突き合わせること。
 */
import {sha256} from './sha.mjs';
import {base32, base32Decode, base58} from './base.mjs';

export const RAW = 0x55;
export const DAG_PB = 0x70;
export const CHUNK = 256 * 1024; // 既定のチャンク幅
export const MAX_LINKS = 174;    // 既定の 1 ノードあたりのリンク数上限

// ── protobuf (必要な分だけ) ──────────────────────────────────────
function varint(n) {
  const out = [];
  let v = BigInt(n);
  do {
    let b = Number(v & 0x7fn);
    v >>= 7n;
    if (v > 0n) b |= 0x80;
    out.push(b);
  } while (v > 0n);
  return Buffer.from(out);
}

const tag = (field, wire) => varint((field << 3) | wire);
const bytesField = (field, buf) => Buffer.concat([tag(field, 2), varint(buf.length), buf]);
const uintField = (field, n) => Buffer.concat([tag(field, 0), varint(n)]);

/** UnixFS の Data メッセージ。フィールド番号順に並べる */
function unixfs({type, filesize, blocksizes = []}) {
  const parts = [uintField(1, type)];
  if (filesize !== undefined) parts.push(uintField(3, filesize));
  for (const b of blocksizes) parts.push(uintField(4, b));
  return Buffer.concat(parts);
}

/** dag-pb の PBNode。**Links が先、Data が後** */
function pbNode({links = [], data}) {
  const parts = [];
  for (const l of links) {
    parts.push(bytesField(2, Buffer.concat([
      bytesField(1, l.hash),                              // Hash (CID のバイト列)
      bytesField(2, Buffer.from(l.name ?? '', 'utf8')),   // Name (空でも出す)
      uintField(3, l.tsize),                              // Tsize
    ])));
  }
  if (data) parts.push(bytesField(1, data));
  return Buffer.concat(parts);
}

// ── CID の組み立て ──────────────────────────────────────────────
/** multihash: sha2-256 (0x12) + 長さ 32 (0x20) + digest */
const multihash = (digest) => Buffer.concat([Buffer.from([0x12, 0x20]), digest]);

/** CIDv1: 0x01 + codec + multihash。multibase 'b' (base32 小文字) */
export const cidV1 = (codec, digest) =>
  'b' + base32(Buffer.concat([Buffer.from([0x01, codec]), multihash(digest)]));

/** CIDv0: multihash を base58btc しただけ。dag-pb 固定 */
export const cidV0 = (digest) => base58(multihash(digest));

/** CIDv1 のバイト列 (dag-pb の Link に入れる形) */
const cidBytesV1 = (codec, digest) => Buffer.concat([Buffer.from([0x01, codec]), multihash(digest)]);

/**
 * ファイル 1 本の CID。`ipfs add --cid-version=1 --raw-leaves` に合わせる。
 * @param {Buffer} data
 */
export function fileCid(data, {chunk = CHUNK} = {}) {
  if (data.length <= chunk) {
    const digest = sha256(data);
    return {
      cid: cidV1(RAW, digest),
      codec: 'raw',
      bytes: data.length,
      chunks: 1,
      sha256: Buffer.from(digest).toString('hex'),
      cidBytes: cidBytesV1(RAW, digest),
      dagSize: data.length, // このファイルが占めるブロックの合計 (Link の Tsize に入れる値)
    };
  }

  const links = [];
  const blocksizes = [];
  for (let o = 0; o < data.length; o += chunk) {
    const part = data.subarray(o, Math.min(o + chunk, data.length));
    links.push({hash: cidBytesV1(RAW, sha256(part)), name: '', tsize: part.length});
    blocksizes.push(part.length);
  }
  if (links.length > MAX_LINKS) {
    throw new Error(
      `チャンクが ${links.length} 個で上限 ${MAX_LINKS} を超えました。` +
      '中間ノードを積む釣り合った木が必要です (この試作は 1 段だけ)'
    );
  }

  const node = pbNode({links, data: unixfs({type: 2, filesize: data.length, blocksizes})});
  const digest = sha256(node);
  return {
    cid: cidV1(DAG_PB, digest),
    codec: 'dag-pb',
    bytes: data.length,
    chunks: links.length,
    sha256: Buffer.from(digest).toString('hex'),
    nodeBytes: node.length,
    cidBytes: cidBytesV1(DAG_PB, digest),
    dagSize: node.length + data.length, // 中間ノード + チャンクの合計
  };
}

/**
 * ディレクトリ 1 段の CID。`ipfs add -r --cid-version=1 --raw-leaves` のルートに合わせる。
 * @param {{name: string, cid: ReturnType<typeof fileCid>}[]} files
 *
 * **2026-08-26 に kubo 0.43.0 と照合済み。** Links を名前順に並べること、
 * Tsize に「その下のブロックの合計」を入れること、ディレクトリの Data に
 * filesize を入れないこと、いずれも仕様どおりだった
 * (`ipfs add -rn --cid-version=1 --raw-leaves` と 54 ファイル + ディレクトリで一致)。
 */
export function dirCid(files) {
  const links = [...files]
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((f) => ({hash: f.cid.cidBytes, name: f.name, tsize: f.cid.dagSize}));
  const node = pbNode({links, data: unixfs({type: 1})});
  const digest = sha256(node);
  const childBytes = files.reduce((n, f) => n + f.cid.dagSize, 0);
  return {
    cid: cidV1(DAG_PB, digest),
    codec: 'dag-pb',
    links: links.length,
    nodeBytes: node.length,
    dagSize: node.length + childBytes,
    verified: false,
  };
}

/** CID から SHA-256 に戻す (場所に依存しないことの確認用) */
export function digestFromCid(cid) {
  if (!cid.startsWith('b')) throw new Error(`base32 の CIDv1 ではない: ${cid}`);
  const b = base32Decode(cid.slice(1));
  if (b[0] !== 0x01) throw new Error('CIDv1 ではありません');
  if (b[2] !== 0x12 || b[3] !== 0x20) throw new Error('sha2-256 ではありません');
  return {codec: b[1], digest: Buffer.from(b.subarray(4))};
}

// ── 検証用 (00-selftest から呼ぶ) ────────────────────────────────
/** 空の UnixFS ディレクトリ。公開されている値と照合するために作る */
export const emptyDirNode = () => pbNode({data: unixfs({type: 1})});

/** 空の UnixFS ファイル */
export const emptyFileNode = () => pbNode({data: unixfs({type: 2, filesize: 0})});
