/**
 * AWS SigV4 の署名。**Filebase に CAR を上げるために要る**。
 *
 * ── なぜ S3 なのか ──────────────────────────────────────────────
 * IPFS の pinning サービスには標準の API (IPFS Pinning Service API) がある。
 * ただしあれは「この CID を固定して」と**頼むだけ**で、中身は渡さない。
 * サービス側はネットワークからその CID を探しに行く。**誰も配っていない
 * データは見つからない**ので、手元でデーモンを上げっぱなしにして
 * 見つけてもらう必要がある。NAT の内側だと通ったり通らなかったりする。
 *
 * Filebase は S3 互換の窓口を持っていて、**中身をこちらから渡せる**。
 * 探しに来てもらう必要がない。だからこちらを使う。
 *
 * ── CAR で渡す理由 ──────────────────────────────────────────────
 * ファイルを 1 つずつ上げると、サービス側が独自に DAG を組み直すので
 * **ディレクトリの CID が変わることがある**。こちらは
 * bafybeihheff… という値を kubo と突き合わせて確定させてある。変えたくない。
 *
 * CAR (Content Addressable aRchive) は DAG をブロックごと丸ごと詰めた箱で、
 * `x-amz-meta-import: car` を付けて渡すと、**CID をそのまま保って**取り込まれる。
 *
 * ── 署名の手順 (4 段) ───────────────────────────────────────────
 *   1. 正準リクエスト  メソッド・パス・ヘッダ・本文ハッシュを決まった順に並べる
 *   2. 署名対象文字列  日付とスコープと、1 の SHA-256
 *   3. 署名鍵          秘密鍵から日付→地域→サービスへと HMAC を 4 回かける
 *   4. 署名            3 の鍵で 2 を HMAC
 *
 * 3 が回りくどいのは、**日付と地域に縛られた鍵**を作るためである。
 * 漏れても、その日その地域のその用途にしか使えない。
 */
import {createHash, createHmac} from 'node:crypto';

const sha256hex = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

/** ISO 8601 の basic 形式。20260826T041500Z */
function stamps(now) {
  const iso = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return {amzDate: iso, dateStamp: iso.slice(0, 8)};
}

/**
 * 署名済みのヘッダを組み立てる。本文 (body) は Buffer で渡す。
 * URL とヘッダを返すので、呼ぶ側は fetch にそのまま渡せる。
 */
export function signS3Put({endpoint, bucket, key, body, accessKey, secretKey,
  region = 'us-east-1', extraHeaders = {}, now = new Date()}) {
  const host = new URL(endpoint).host;
  const {amzDate, dateStamp} = stamps(now);
  const payloadHash = sha256hex(body);
  // S3 のキーは URI エンコードするが、'/' は残す
  const canonicalUri = '/' + [bucket, ...key.split('/')].map(encodeURIComponent).join('/');

  const headers = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...Object.fromEntries(Object.entries(extraHeaders).map(([k, v]) => [k.toLowerCase(), v])),
  };
  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames.map((h) => `${h}:${String(headers[h]).trim()}\n`).join('');
  const signedHeaders = signedHeaderNames.join(';');

  // 1. 正準リクエスト
  const canonicalRequest = ['PUT', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  // 2. 署名対象文字列
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join('\n');

  // 3. 署名鍵。日付 → 地域 → サービス → 用途 の順に縛る
  const kDate = hmac('AWS4' + secretKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');

  // 4. 署名
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  return {
    url: `${endpoint.replace(/\/$/, '')}${canonicalUri}`,
    headers: {
      ...Object.fromEntries(Object.entries(headers).filter(([k]) => k !== 'host')),
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, `
        + `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    // 検証用。テストで公開ベクトルと突き合わせるために出す
    debug: {canonicalRequest, stringToSign, signature},
  };
}
