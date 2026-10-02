/**
 * Keccak-256。**Node の crypto に無いので自分で書く**。
 *
 * ── なぜ要るのか ────────────────────────────────────────────────
 * ここまでの試作では、関数セレクタとイベント topic を `cast sig` / `cast keccak` で
 * 求めて **定数として貼っていた** (lib/abi.mjs の SIG / TOPIC)。CorpusAnchor のように
 * 関数が 4 つなら手で貼れる。Ocean Protocol はそうならない。
 *
 *   - 呼ぶ関数が増える (createNftWithErc20WithDispenser / setMetaData / createERC20 …)
 *   - 引数が入れ子の構造体なので、シグネチャの文字列を 1 文字間違えると
 *     **通らないのではなく、別の関数に当たって静かに失敗する**
 *   - Ocean の DID は `sha256(EIP-55 のアドレス + chainId)` で、
 *     EIP-55 のチェックサム自身が Keccak-256 を要る
 *
 * `cast` を実行時に呼ぶ形にもできるが、それは「ハッシュを外部プロセスに聞く」
 * ことになる。ハッシュは試作の中心なので、手元で計算できる形にする。
 *
 * ── Node の sha3-256 では駄目な理由 ─────────────────────────────
 * `crypto.createHash('sha3-256')` は **SHA-3** で、Ethereum の Keccak-256 とは
 * **パディングが 1 バイト違う** (SHA-3 は 0x06、Keccak は 0x01)。
 * それだけで出力が完全に別物になる。同じ「SHA-3 系」なので混同しやすい。
 *
 * ── 実装の方針 ──────────────────────────────────────────────────
 * 64 ビットのレーン 25 本を **BigInt** で持つ。32 ビット 2 語に割る実装のほうが
 * 速いが、ここで呼ぶ回数はセレクタとアドレスの数 (数十回) なので速さは要らない。
 * 読んで正しさを確かめられることを優先する。
 *
 * 正しさは 00-selftest.mjs で公開値と突き合わせる (空文字列・"abc"・
 * ERC-20 Transfer の topic・既に定数で持っていた 4 つのセレクタ)。
 */

const MASK = (1n << 64n) - 1n;

// ラウンド定数 (FIPS 202 の RC)
const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

// 回転量 r[x][y]。レーンの番号は x + 5y
const ROT = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14],
];

const rotl = (v, n) => (n === 0 ? v : ((v << BigInt(n)) | (v >> BigInt(64 - n))) & MASK);

/** Keccak-f[1600] の置換。状態は 25 本の BigInt を破壊的に更新する */
function permute(a) {
  for (let round = 0; round < 24; round++) {
    // θ: 列ごとに畳んで、隣の列と混ぜる
    const c = [0n, 0n, 0n, 0n, 0n];
    for (let x = 0; x < 5; x++) c[x] = a[x] ^ a[x + 5] ^ a[x + 10] ^ a[x + 15] ^ a[x + 20];
    for (let x = 0; x < 5; x++) {
      const d = c[(x + 4) % 5] ^ rotl(c[(x + 1) % 5], 1);
      for (let y = 0; y < 5; y++) a[x + 5 * y] ^= d;
    }
    // ρ (回転) と π (置き換え) を同時に。B[y][2x+3y] = rot(A[x][y], r[x][y])
    const b = new Array(25).fill(0n);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(a[x + 5 * y], ROT[x][y]);
      }
    }
    // χ: 行の中で 3 つのレーンを混ぜる (ここだけが非線形)
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        a[x + 5 * y] = b[x + 5 * y] ^ (~b[((x + 1) % 5) + 5 * y] & b[((x + 2) % 5) + 5 * y] & MASK);
      }
    }
    // ι: ラウンドごとに違う定数を 1 本目に混ぜる (対称性を崩す)
    a[0] ^= RC[round];
  }
}

/**
 * Keccak-256。
 * @param {...(Buffer|string)} parts 連結して食わせる。string は UTF-8
 * @returns {Buffer} 32 バイト
 */
export function keccak256(...parts) {
  const msg = Buffer.concat(parts.map((p) => (Buffer.isBuffer(p) ? p : Buffer.from(String(p), 'utf8'))));
  const RATE = 136; // 1088 ビット = (1600 - 256*2) / 8

  // パディング (pad10*1)。Keccak は 0x01、SHA-3 は 0x06。**ここが両者の違い**
  const padLen = RATE - (msg.length % RATE);
  const padded = Buffer.concat([msg, Buffer.alloc(padLen)]);
  padded[msg.length] = 0x01;
  padded[padded.length - 1] |= 0x80;

  const a = new Array(25).fill(0n);
  for (let off = 0; off < padded.length; off += RATE) {
    // 吸収。レーンはリトルエンディアン
    for (let i = 0; i < RATE / 8; i++) {
      a[i] ^= padded.readBigUInt64LE(off + i * 8);
    }
    permute(a);
  }

  const out = Buffer.alloc(32);
  for (let i = 0; i < 4; i++) out.writeBigUInt64LE(a[i], i * 8);
  return out;
}

/** 関数セレクタ。'anchor(bytes32,bytes32)' → '0xf0c537ef' */
export const selector = (sig) => '0x' + keccak256(sig).subarray(0, 4).toString('hex');

/** イベントの topic0 */
export const eventTopic = (sig) => '0x' + keccak256(sig).toString('hex');

/**
 * EIP-55 のチェックサム付きアドレス。
 * 小文字の 16 進 40 文字を Keccak-256 に掛け、その i 桁目が 8 以上なら
 * アドレスの i 文字目を大文字にする。**Ocean の DID がこの形のアドレスを要る**ので、
 * 見た目の問題ではなく計算に効く。
 */
export function toChecksumAddress(addr) {
  const lower = String(addr).replace(/^0x/, '').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(lower)) throw new Error(`アドレスの形が違う: ${addr}`);
  const h = keccak256(lower).toString('hex');
  let out = '0x';
  for (let i = 0; i < 40; i++) {
    out += parseInt(h[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i];
  }
  return out;
}
