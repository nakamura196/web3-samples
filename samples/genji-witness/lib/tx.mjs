/**
 * EIP-1559 (type 2) のトランザクションを組み立てて署名する。
 *
 * ── ここまでとの違い ────────────────────────────────────────────
 * lib/rpc.mjs の sendTx() は `eth_sendTransaction` を呼ぶ。これは
 * **「ノードが鍵を持っている」ことを前提にした窓口**で、anvil か、鍵を預けた
 * 自前のノードにしか無い。Infura も publicnode も持っていない (持っていたら
 * 誰でも他人の名前で送れてしまう)。
 *
 * 公開チェーンに出す道は 1 本しかない。**署名済みのバイト列を手元で作り**、
 * `eth_sendRawTransaction` に渡す。このファイルがその組み立てを担う。
 *
 * ── 中身は 9 つの欄と、署名の 3 つ ──────────────────────────────
 *   0x02 || rlp([chainId, nonce, maxPriorityFeePerGas, maxFeePerGas,
 *                gasLimit, to, value, data, accessList])
 * これを Keccak-256 したものに署名し、後ろに yParity, r, s を足して送る。
 *
 * 先頭の 0x02 は RLP の外側に**生のまま**置く (EIP-2718 の型番)。ここを RLP の
 * 中に入れると、旧形式のトランザクションとして解釈されて弾かれる。
 *
 * ── chainId が中に入っている意味 ────────────────────────────────
 * 署名の対象に chainId が含まれるので、**Sepolia 用に署名したものを mainnet に
 * 流し込めない** (EIP-155 が旧形式に後付けした保護を、新形式は最初から持っている)。
 * この試作にとっては実際的な意味がある。フォークした anvil (chainId 11155111) 向けに
 * 作った署名は、本物の Sepolia でもそのまま有効になる。**手元の実験のつもりで
 * 署名したものが、公開チェーンで通ってしまう**ということなので、
 * 送信先の URL だけでなく署名の中身も見て確かめる。
 *
 * ── 2 種類の手数料 ──────────────────────────────────────────────
 *   maxFeePerGas          1 ガスあたり払ってよい上限 (基本手数料 + 優先手数料)
 *   maxPriorityFeePerGas  そのうちバリデータに渡す分
 * 実際に引かれるのは min(maxFee, baseFee + priority)。基本手数料は焼かれる。
 * baseFee はブロックごとに動くので、上限は今の値の 2 倍ほど取っておく。
 */
import {encode} from './rlp.mjs';
import {keccak256, toChecksumAddress} from './keccak.mjs';
import {sign, publicKey, publicKeyBytes} from './secp256k1.mjs';

export const TYPE_1559 = 0x02;

/** 秘密鍵からアドレス (EIP-55 のチェックサム付き) */
export function addressOf(priv) {
  const raw = '0x' + keccak256(publicKeyBytes(publicKey(priv))).subarray(12).toString('hex');
  return toChecksumAddress(raw);
}

/** 署名前の 9 欄。数は BigInt、アドレスと data は 0x 文字列で渡す */
function fields(tx) {
  const need = (k) => {
    if (tx[k] === undefined || tx[k] === null) throw new Error(`${k} が無い`);
    return BigInt(tx[k]);
  };
  return [
    need('chainId'),
    need('nonce'),
    need('maxPriorityFeePerGas'),
    need('maxFeePerGas'),
    need('gas'),
    tx.to ?? '',                    // 空ならコントラクト作成
    tx.value === undefined ? 0n : BigInt(tx.value),
    tx.data ?? '0x',
    tx.accessList ?? [],
  ];
}

/** 署名の対象になるバイト列と、そのハッシュ */
export function signingPayload(tx) {
  const payload = Buffer.concat([Buffer.from([TYPE_1559]), encode(fields(tx))]);
  return {payload, hash: keccak256(payload)};
}

/**
 * 署名して、そのまま eth_sendRawTransaction に渡せる形にする。
 *
 * r と s は **数として** RLP に入れる (前ゼロを落とす)。32 バイト固定で入れると
 * 前ゼロがあるときにバイト列が変わり、txHash が他の実装とずれる。
 */
export function signTransaction(tx, priv) {
  const {hash} = signingPayload(tx);
  const sig = sign(hash, priv);
  const signed = Buffer.concat([
    Buffer.from([TYPE_1559]),
    encode([...fields(tx), BigInt(sig.recovery & 1), sig.r, sig.s]),
  ]);
  return {
    raw: '0x' + signed.toString('hex'),
    hash: '0x' + keccak256(signed).toString('hex'),
    from: addressOf(priv),
    signingHash: '0x' + hash.toString('hex'),
    yParity: sig.recovery & 1,
    r: sig.hex.r,
    s: sig.hex.s,
  };
}

/** 手数料の上限を決める。baseFee は動くので余裕を持たせる */
export function feesFrom(baseFeeWei, {priorityGwei = 1, headroom = 2n} = {}) {
  const base = BigInt(baseFeeWei);
  const priority = BigInt(Math.round(priorityGwei * 1e9));
  return {maxPriorityFeePerGas: priority, maxFeePerGas: base * headroom + priority};
}

/**
 * EIP-191 の「個人署名」(personal_sign)。**トランザクションではない文に署名する**。
 *
 *   hash = keccak256("\x19Ethereum Signed Message:\n" + 長さ + 本文)
 *
 * 先頭に 0x19 と決まり文句を付けるのが要点である。これが無いと、
 * 署名させた「ただの文字列」が**そのままトランザクションとして解釈できてしまう**
 * 恐れがある (0x19 で始まる RLP は存在しないので、混ざらないことが保証される)。
 *
 * 用途: 「このアドレスは私のものだ」と現実の側から宣言する。
 * cast wallet verify や ethers.verifyMessage でそのまま検証できる形にする。
 */
export function signMessage(message, priv) {
  const body = Buffer.from(message, 'utf8');
  const prefix = Buffer.from(`\x19Ethereum Signed Message:\n${body.length}`, 'utf8');
  const hash = keccak256(Buffer.concat([prefix, body]));
  const sig = sign(hash, priv);
  // v は 27/28。r||s||v の 65 バイト
  const v = (sig.recovery & 1) + 27;
  return {
    message,
    address: addressOf(priv),
    hash: '0x' + hash.toString('hex'),
    signature: sig.hex.r + sig.hex.s.slice(2) + v.toString(16).padStart(2, '0'),
  };
}
