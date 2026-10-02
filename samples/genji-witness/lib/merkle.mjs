/**
 * Merkle ツリー。**RFC 6962 (Certificate Transparency) の定義そのまま**を使う。
 *
 * ── なぜ自分で考えた木にしないのか ──────────────────────────────
 * ツリーの組み方を自分で決めると、ほぼ必ず葉の数が奇数のときの扱いで穴が空く。
 * よくある「余った葉を複製して偶数にする」方式には、**葉の並びが違うのに同じ root に
 * なる**組み合わせが存在する (Bitcoin の CVE-2012-2459 と同じ穴)。
 * 「この行はこの版に含まれていた」を証明する道具でそれが起きると、
 * 含まれていなかった行を含まれていたことにできる。
 *
 * RFC 6962 は葉の数が 2 の冪でなくても一意に決まる。分割位置を
 * 「n より小さい最大の 2 の冪」に固定しているためで、複製をしない。
 * Certificate Transparency が 10 年以上動かしている定義なので、ここは借りる。
 *
 * ── 定義 ────────────────────────────────────────────────────────
 *   MTH({})      = SHA-256()                        空
 *   MTH({d0})    = SHA-256(0x00 || d0)              葉
 *   MTH(D[n])    = SHA-256(0x01 || MTH(D[0:k]) || MTH(D[k:n]))
 *                  k = n より小さい最大の 2 の冪
 *
 * 先頭の 0x00 / 0x01 は**葉と節を区別するため**にある。これが無いと、
 * ある節のハッシュを葉として提出する攻撃 (second-preimage) が通る。
 *
 * ── 何が嬉しいのか ──────────────────────────────────────────────
 * 25,065 行のうち 1 行が「この版に含まれていた」ことを、
 * **15 個のハッシュ (480 バイト)** で示せる。本文 5.87 MB を渡す必要がない。
 * 論文で 1 行を引用した人が、引用元の版を相手に証明させられる形になる。
 */
import {sha256} from './sha.mjs';

const LEAF = Buffer.from([0x00]);
const NODE = Buffer.from([0x01]);

export const SPEC = 'rfc6962-sha256';

/** n より小さい最大の 2 の冪 (n >= 2) */
export function splitPoint(n) {
  let k = 1;
  while (k * 2 < n) k *= 2;
  return k;
}

/** 葉のハッシュ。entry は Buffer (正規化済みのバイト列) */
export const leafHash = (entry) => sha256(LEAF, entry);

/** 節のハッシュ */
export const nodeHash = (left, right) => sha256(NODE, left, right);

/**
 * Merkle Tree Hash。葉ハッシュの配列を受け取って root を返す。
 * @param {Buffer[]} leaves leafHash() を通した値の配列
 */
export function root(leaves) {
  if (leaves.length === 0) return sha256(Buffer.alloc(0));
  if (leaves.length === 1) return leaves[0];
  const k = splitPoint(leaves.length);
  return nodeHash(root(leaves.slice(0, k)), root(leaves.slice(k)));
}

/**
 * 包含証明 (RFC 6962 の PATH)。
 * @param {number} m 証明したい葉の位置 (0 起算)
 * @param {Buffer[]} leaves 葉ハッシュの配列
 * @returns {Buffer[]} 兄弟ハッシュの列。葉の側から根の側へ並ぶ
 */
export function proof(m, leaves) {
  const n = leaves.length;
  if (m < 0 || m >= n) throw new Error(`葉の位置が範囲外: ${m} (葉は ${n} 個)`);
  if (n === 1) return [];
  const k = splitPoint(n);
  return m < k
    ? [...proof(m, leaves.slice(0, k)), root(leaves.slice(k))]
    : [...proof(m - k, leaves.slice(k)), root(leaves.slice(0, k))];
}

/**
 * 包含証明の検証。RFC 6962 セクション 2.1.1 のアルゴリズム。
 *
 * **オフチェーンとオンチェーンで同じ手順**にしてある (contracts/src/CorpusAnchor.sol)。
 * 片方だけ直すと通らなくなるので、変えるときは両方を変える。
 *
 * ── 包含証明は treeSize を縛らない ──────────────────────────────
 * この検証が示すのは (root, index, entry) の 3 つ組であって、**treeSize は含まれない**。
 * たとえば index 0 の証明では経路が全部「右の兄弟」になり、分岐の判定に使う fn は
 * 0 のまま動かないので、treeSize が 5 でも 8 でも計算が 1 バイトも変わらない。
 * つまり treeSize を偽っても通ることがある。
 *
 * だから **treeSize は証明から推測せず、アンカーの記録 (CorpusAnchored の
 * treeSize) から取る**。CorpusAnchor.anchor が treeSize を必須の引数に
 * しているのはこのためで、飾りではない。
 * (contracts/test/CorpusAnchor.t.sol の
 *  test_verify_treeSizeIsNotBoundByProof_leftmostLeaf がこの性質を固定している)
 *
 * @param {Buffer} entry     葉の中身 (ハッシュ前のバイト列)
 * @param {number} index     葉の位置 (0 起算)
 * @param {number} treeSize  葉の総数
 * @param {Buffer[]} path    proof() が返した配列
 * @param {Buffer} expected  root
 */
export function verify(entry, index, treeSize, path, expected) {
  if (index >= treeSize) return false;
  let fn = index;
  let sn = treeSize - 1;
  let r = leafHash(entry);
  for (const sibling of path) {
    if (sn === 0) return false; // 証明が長すぎる
    if (fn % 2 === 1 || fn === sn) {
      r = nodeHash(sibling, r);
      while (fn !== 0 && fn % 2 === 0) {
        fn = Math.floor(fn / 2);
        sn = Math.floor(sn / 2);
      }
    } else {
      r = nodeHash(r, sibling);
    }
    fn = Math.floor(fn / 2);
    sn = Math.floor(sn / 2);
  }
  return sn === 0 && r.equals(expected);
}

/** 証明の長さの上限。葉の数から決まる */
export const proofLength = (treeSize) => (treeSize <= 1 ? 0 : Math.ceil(Math.log2(treeSize)));
