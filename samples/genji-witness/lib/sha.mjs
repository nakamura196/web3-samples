/**
 * SHA-256。依存パッケージなし。
 *
 * ndl-witness は webcrypto (`crypto.subtle.digest`) を使っているが、あちらが扱うのは
 * マニフェスト 1 件で、非同期でも困らなかった。こちらは 25,065 葉の Merkle ツリーを
 * 組むので、1 回のツリー構築で 5 万回以上ハッシュを取る。**同期版が要る**ので
 * `node:crypto` の `createHash` に変えてある。どちらも標準ライブラリで依存は増えない。
 *
 * Keccak-256 ではなく SHA-256 を使う理由は ndl-witness と同じ (Node が Keccak-256 を
 * 持たない) だが、こちらではもう 1 つ理由が増える。Solidity には SHA-256 の
 * プリコンパイル (アドレス 0x02) があり、Merkle の包含証明を**チェーン上で**検証できる。
 * Keccak を選んでいたら、オフチェーン側に自前実装か依存パッケージが必要になっていた。
 */
import {createHash} from 'node:crypto';

/** 連結してから 1 回ハッシュする。Buffer を返す */
export function sha256(...parts) {
  const h = createHash('sha256');
  for (const p of parts) h.update(typeof p === 'string' ? Buffer.from(p, 'utf8') : p);
  return h.digest();
}

export const hex = (buf) => Buffer.from(buf).toString('hex');

/** 0x 付きの bytes32。コントラクトに渡す形 */
export const b32 = (buf) => '0x' + hex(buf);

/** 文字列を SHA-256 して bytes32 にする。識別子の作成用 */
export const idOf = (s) => b32(sha256(s));

export const DIGEST_ALGORITHM = 'SHA-256';
