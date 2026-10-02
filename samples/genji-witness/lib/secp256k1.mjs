/**
 * secp256k1 の ECDSA 署名。**Node の crypto では Ethereum の形にできないので自分で書く**。
 *
 * ── なぜ標準ライブラリで足りないのか ────────────────────────────
 * `node:crypto` は secp256k1 の鍵も署名も扱える。ただし出てくるのは **DER** で、
 * Ethereum が要る形とは 2 点ずれる。
 *
 *   1. Ethereum は (r, s) を生のまま 32 バイトずつ並べる。DER の入れ子は要らない
 *   2. Ethereum は **復元 id (v / yParity)** を要る。DER には入っていない
 *
 * 2 が本質的である。Ethereum のトランザクションには「送信者」の欄が無い。
 * ノードは署名から公開鍵を**復元して**送信者を決める。そのとき候補が 2 つ (稀に 4 つ)
 * 出るので、どれかを 1 ビットで指しておく必要がある。この 1 ビットは署名の計算の
 * 途中でしか分からず、DER を後から見ても復元できない。だから署名器の中で拾う。
 *
 * ── low-s に正規化する ──────────────────────────────────────────
 * (r, s) が有効なら (r, n - s) も同じ鍵の有効な署名になる。つまり署名は 2 通り書ける。
 * これを放置すると、中身が同じなのにハッシュの違うトランザクションが 2 つ作れてしまう
 * (トランザクション展性)。Ethereum は EIP-2 で **s <= n/2 の側だけ**を有効とした。
 * ひっくり返したときは復元 id も反転する。ここを忘れると署名は有効なのに
 * **送信者が別のアドレスとして復元される**ので、残高が無いと言われて落ちる。
 *
 * ── k を乱数で選ばない (RFC 6979) ───────────────────────────────
 * ECDSA は、1 回の署名ごとに使い捨ての数 k を要る。**k が漏れると秘密鍵が割れる**し、
 * 2 回同じ k を使っても割れる (PS3 の鍵が割れたのはこれ)。乱数生成器の質に
 * 秘密鍵の安全性がぶら下がる形になる。
 *
 * RFC 6979 は k を「秘密鍵とメッセージから HMAC で決める」ことにして、乱数を消した。
 * 同じ入力なら毎回同じ署名になるので、**cast の出力とバイト単位で突き合わせられる**
 * という副産物がある。00-selftest.mjs はこれを使って検証している。
 *
 * ── この実装の限界。はっきり書いておく ──────────────────────────
 * **一定時間で動く実装ではない** (not constant-time)。スカラー倍が 1 ビットずつ
 * 分岐するので、実行時間や電力から秘密鍵のビットが漏れうる。手元で自分の
 * テストネット鍵に署名する用途を想定している。**本番の資金を持つ鍵には使わないこと。**
 * 実用には noble-secp256k1 のような検証済みの実装を使う。
 *
 * 読みやすさを優先してアフィン座標のまま書いてある。1 回の署名で法逆元を
 * 500 回ほど取るが、署名は 1 トランザクションに 1 回なので速さは要らない。
 */
import {createHmac} from 'node:crypto';

// y^2 = x^3 + 7 (mod p)
export const P = 2n ** 256n - 2n ** 32n - 977n;
export const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const Gx = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
const Gy = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;
export const G = {x: Gx, y: Gy};

/** 正の剰余。BigInt の % は負を返すので挟む */
const mod = (a, m = P) => ((a % m) + m) % m;

/** 拡張ユークリッドで法逆元。a^-1 mod m */
function invert(a, m = P) {
  if (a === 0n) throw new Error('0 に逆元は無い');
  let [old_r, r] = [mod(a, m), m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  return mod(old_s, m);
}

/** 無限遠点は null で表す */
function double(Pt) {
  if (Pt === null || Pt.y === 0n) return null;
  const lam = mod(3n * Pt.x * Pt.x * invert(2n * Pt.y));
  const x = mod(lam * lam - 2n * Pt.x);
  return {x, y: mod(lam * (Pt.x - x) - Pt.y)};
}

function add(A, B) {
  if (A === null) return B;
  if (B === null) return A;
  if (A.x === B.x) return A.y === B.y ? double(A) : null;   // 同じ点なら 2 倍、対称なら無限遠
  const lam = mod((B.y - A.y) * invert(B.x - A.x));
  const x = mod(lam * lam - A.x - B.x);
  return {x, y: mod(lam * (A.x - x) - A.y)};
}

/** double-and-add。上位ビットから */
export function multiply(k, Pt = G) {
  if (k <= 0n || k >= N) throw new Error('スカラーが範囲外');
  let acc = null;
  for (let bit = k.toString(2).length - 1; bit >= 0; bit--) {
    acc = double(acc);
    if ((k >> BigInt(bit)) & 1n) acc = add(acc, Pt);
  }
  return acc;
}

const to32 = (v) => Buffer.from(v.toString(16).padStart(64, '0'), 'hex');
const fromBuf = (b) => BigInt('0x' + Buffer.from(b).toString('hex'));

/** 秘密鍵 (32 バイト) から公開鍵の点を求める */
export function publicKey(priv) {
  const d = typeof priv === 'bigint' ? priv : fromBuf(toBytes32(priv));
  if (d <= 0n || d >= N) throw new Error('秘密鍵が範囲外');
  return multiply(d);
}

/** 公開鍵を 64 バイト (x||y) にする。先頭の 0x04 は付けない */
export const publicKeyBytes = (pub) => Buffer.concat([to32(pub.x), to32(pub.y)]);

function toBytes32(v) {
  if (Buffer.isBuffer(v)) return v;
  if (typeof v === 'string') return Buffer.from(v.replace(/^0x/, ''), 'hex');
  throw new Error('秘密鍵は Buffer か 0x 文字列で渡す');
}

/**
 * RFC 6979。秘密鍵とメッセージハッシュから k を決める。乱数を使わない。
 *
 * bits2octets が「ハッシュを n で割った余りを 32 バイトに戻す」ところが要点で、
 * ハッシュが n 以上のときにここを飛ばすと、他の実装と k が食い違う。
 */
function deterministicK(hash, d, attempt) {
  const h1 = Buffer.from(hash);
  const bits2octets = to32(mod(fromBuf(h1), N));
  let v = Buffer.alloc(32, 0x01);
  let k = Buffer.alloc(32, 0x00);
  const hmac = (key, ...parts) => createHmac('sha256', key).update(Buffer.concat(parts)).digest();

  k = hmac(k, v, Buffer.from([0x00]), to32(d), bits2octets);
  v = hmac(k, v);
  k = hmac(k, v, Buffer.from([0x01]), to32(d), bits2octets);
  v = hmac(k, v);

  // 候補が使えないとき (k が範囲外 / r が 0) のために何度でも回せる形にする
  for (let i = 0; i <= attempt; i++) {
    v = hmac(k, v);
    const cand = fromBuf(v);
    if (i === attempt) {
      if (cand >= 1n && cand < N) return cand;
      // 使えない候補だったら、規定の手順で次を作って同じ回数まで進める
    }
    if (cand < 1n || cand >= N) {
      k = hmac(k, v, Buffer.from([0x00]));
      v = hmac(k, v);
      i--; // 候補として数えない
      continue;
    }
    k = hmac(k, v, Buffer.from([0x00]));
    v = hmac(k, v);
  }
  throw new Error('k を決められない');
}

/**
 * 32 バイトのハッシュに署名する。**ハッシュはここでは取らない** (呼ぶ側で取る)。
 *
 * 返すのは {r, s, recovery}。recovery は 0..3 で、EIP-1559 では yParity として
 * そのまま入る。旧形式では 27 を足したものが v になる。
 */
export function sign(hash, priv) {
  const h = Buffer.from(typeof hash === 'string' ? hash.replace(/^0x/, '') : hash,
    typeof hash === 'string' ? 'hex' : undefined);
  if (h.length !== 32) throw new Error(`ハッシュは 32 バイト: ${h.length}`);
  const d = fromBuf(toBytes32(priv));
  if (d <= 0n || d >= N) throw new Error('秘密鍵が範囲外');
  const z = fromBuf(h);

  for (let attempt = 0; attempt < 16; attempt++) {
    const k = deterministicK(h, d, attempt);
    const R = multiply(k);
    const r = mod(R.x, N);
    if (r === 0n) continue;
    let s = mod(invert(k, N) * (z + r * d), N);
    if (s === 0n) continue;
    // R.x が n を超えていたら復元時に区別が要る (実際にはほぼ起きない)
    let recovery = Number(R.y & 1n) | (R.x >= N ? 2 : 0);
    if (s > N / 2n) {          // ← EIP-2 の low-s。ひっくり返したら id も反転
      s = N - s;
      recovery ^= 1;
    }
    return {r, s, recovery, hex: {r: '0x' + to32(r).toString('hex'), s: '0x' + to32(s).toString('hex')}};
  }
  throw new Error('署名できない');
}

/** 検証。自分の署名を自分で確かめる用 (00-selftest.mjs) */
export function verify(hash, {r, s}, pub) {
  const z = fromBuf(Buffer.from(typeof hash === 'string' ? hash.replace(/^0x/, '') : hash,
    typeof hash === 'string' ? 'hex' : undefined));
  if (r <= 0n || r >= N || s <= 0n || s >= N) return false;
  const w = invert(s, N);
  const p1 = multiply(mod(z * w, N));
  const p2 = multiply(mod(r * w, N), pub);
  const R = add(p1, p2);
  return R !== null && mod(R.x, N) === r;
}
