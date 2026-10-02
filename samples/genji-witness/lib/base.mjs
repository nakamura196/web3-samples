/**
 * base32 と base58btc。依存パッケージなし。
 *
 * base32 は ndl-witness/lib/cid.mjs から持ってきた (CIDv1 の表記に使う)。
 * base58btc を足したのは、**自前の実装を公開されている値と突き合わせる**ためだけ。
 * 世の中に載っている IPFS の検証値は CIDv0 (base58btc) で書かれていることが多く、
 * base32 しか持っていないと照合できない。scripts/00-selftest.mjs で使う。
 */

const B32 = 'abcdefghijklmnopqrstuvwxyz234567';
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** RFC 4648 base32、小文字・パディングなし (multibase の 'b') */
export function base32(bytes) {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s) {
  let bits = 0, value = 0;
  const out = [];
  for (const ch of s) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error(`base32 として不正な文字: ${ch}`);
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** base58btc (Bitcoin と同じ字種)。CIDv0 の表記 */
export function base58(bytes) {
  const digits = [0];
  for (const b of bytes) {
    let carry = b;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = '';
  for (const b of bytes) {
    if (b !== 0) break;
    out += B58[0]; // 先頭のゼロバイトは '1' として保つ
  }
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  return out;
}
