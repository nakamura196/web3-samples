/**
 * 本文を IPFS に載せる。**既定では送りません。**
 *
 *   node scripts/08-ipfs.mjs                     下見。CID を照合して CAR を作るだけ
 *   op run --env-file=.env.local -- node scripts/08-ipfs.mjs --upload   Filebase に上げる
 *   node scripts/08-ipfs.mjs --check             公開ゲートウェイから引けるか確かめる
 *
 * ── なぜこれが要るのか ──────────────────────────────────────────
 * 07-sepolia.mjs で root をチェーンに刻んだ。しかし root は
 * 「本文が変わっていないこと」しか言わない。**本文がまだ存在することは保証しない。**
 *
 * いま DDO の serviceEndpoint は https://kouigenjimonogatari.github.io/ を指している。
 * つまりカタログは **GitHub を指す道しるべ**で、GitHub が消えたら
 * 何もない方向を指す。行き先を「内容そのものが住所になっている CID」に変える。
 *
 * ── 消せる、ということ ──────────────────────────────────────────
 * **Filebase に上げたものは消せる。** IPFS に「削除」という操作は無く、
 * あるのは「誰も持たなくなる」だけである。Filebase は「持ち続ける」を
 * 引き受ける会社で、こちらがオブジェクトを消せば引き受けをやめる。
 * 誰も持たなくなれば、CID は残るが中身は取れなくなる。
 *
 * 取り消せないのは Arweave のほうで、そこは別の判断として切り離してある
 * (04-permanence.mjs と同じ扱い)。
 *
 * ── CID は自前計算と kubo の両方で確かめる ──────────────────────
 * lib/cid.mjs の値と kubo の値が一致することは 2026-08-26 に確認済み
 * (54 ファイル + ディレクトリ、1 件も食い違いなし)。ここでも毎回照合する。
 */
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileCid, dirCid} from '../lib/cid.mjs';
import {readCorpus} from '../lib/tei.mjs';
import {requireRepo, MASTER_DIR} from '../lib/source.mjs';
import {writeJson, OUT, rel} from '../lib/store.mjs';
import {signS3Put} from '../lib/s3.mjs';
import {c, rule, head, padTo} from '../lib/ui.mjs';

const upload = process.argv.includes('--upload');
const check = process.argv.includes('--check');
const CAR = path.join(OUT, 'genji-master.car');

const ipfs = (...args) => execFileSync('ipfs', args, {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024}).trim();

rule(upload ? '本文を Filebase に上げる' : check ? '公開ゲートウェイから引けるか' : 'IPFS — 下見 (送りません)');

// ── どこまでが「送らない」か、毎回明示する ──────────────────────
if (!upload && !check) {
  console.log(`  ${c.warn('このモードは外に一切送りません。')}`);
  console.log(`  ${c.dim('CID を手元で計算し、kubo と突き合わせ、CAR を作るところまでです。')}`);
}

// ── 1. CID を 2 通りで出して突き合わせる ────────────────────────
head('1. CID — 自前計算と kubo が合うか');
const corpus = readCorpus(requireRepo());
// dirCid は {name, cid: fileCid(...)} の形を取る。cid は文字列ではなくオブジェクト
const entries = corpus.map((ch) => ({name: ch.name, bytes: ch.bytes.length, cid: fileCid(ch.bytes)}));
const ours = dirCid(entries);
const files = entries.map((e) => ({name: e.name, bytes: e.bytes, ...e.cid}));

const kuboLines = ipfs('add', '-rn', '--cid-version=1', '--raw-leaves', MASTER_DIR).split('\n');
const kubo = new Map();
for (const line of kuboLines) {
  const m = line.match(/^added (\S+) (.*)$/);
  if (m) kubo.set(m[2].replace(/^master\/?/, '') || '(dir)', m[1]);
}
const bad = files.filter((f) => kubo.get(f.name) !== f.cid);
console.log(`  ファイル     ${files.length} 件  ${bad.length === 0 ? c.ok('一致') : c.ng(bad.length + ' 件不一致')}`);
console.log(`  ディレクトリ  ${kubo.get('(dir)') === ours.cid ? c.ok('一致') : c.ng('不一致')}`);
console.log(`  CID         ${ours.cid}`);
console.log(`  合計         ${corpus.reduce((n, ch) => n + ch.bytes.length, 0).toLocaleString('en-US')} バイト`);
if (bad.length || kubo.get('(dir)') !== ours.cid) {
  console.error(c.ng('  CID が食い違っています。ここが赤いまま先に進まないこと。'));
  process.exit(1);
}

// ── 2. 手元の IPFS リポジトリに入れて CAR にする ────────────────
if (!check) {
  head('2. CAR に固める');
  console.log(`  ${c.dim('手元の ipfs リポジトリに格納します。デーモンは上げないのでネットワークには出ません。')}`);
  const stored = ipfs('add', '-rQ', '--cid-version=1', '--raw-leaves', MASTER_DIR);
  if (stored !== ours.cid) {
    console.error(c.ng(`  格納後の CID が違う: ${stored}`));
    process.exit(1);
  }
  fs.writeFileSync(CAR, execFileSync('ipfs', ['--offline', 'dag', 'export', ours.cid],
    {maxBuffer: 256 * 1024 * 1024}));
  const carBytes = fs.statSync(CAR).size;
  console.log(`  ${rel(CAR)}  ${carBytes.toLocaleString('en-US')} バイト`);
  console.log(`  ${c.dim('CAR は DAG をブロックごと詰めた箱。CID を保ったまま渡せる')}`);
}

// ── 3. Filebase に上げる ────────────────────────────────────────
if (upload) {
  const {FILEBASE_KEY, FILEBASE_SECRET, FILEBASE_BUCKET} = process.env;
  for (const [k, v] of [['FILEBASE_KEY', FILEBASE_KEY], ['FILEBASE_SECRET', FILEBASE_SECRET],
    ['FILEBASE_BUCKET', FILEBASE_BUCKET]]) {
    if (!v || v.startsWith('op://')) {
      console.error(c.ng(`  ${k} がありません (op run を通していますか)`));
      process.exit(1);
    }
  }
  head('3. Filebase に上げる');
  const body = fs.readFileSync(CAR);
  console.log(`  bucket     ${FILEBASE_BUCKET}`);
  console.log(`  大きさ      ${body.length.toLocaleString('en-US')} バイト`);
  console.log(`  ${c.warn('公開ネットワークに出ます。ただし Filebase 上のものは後から消せます。')}`);

  const signed = signS3Put({
    endpoint: 'https://s3.filebase.com', bucket: FILEBASE_BUCKET,
    key: 'genji-master.car', body,
    accessKey: FILEBASE_KEY, secretKey: FILEBASE_SECRET,
    extraHeaders: {'x-amz-meta-import': 'car'},
  });
  const res = await fetch(signed.url, {method: 'PUT', headers: signed.headers, body});
  if (!res.ok) {
    console.error(c.ng(`  失敗 HTTP ${res.status}`));
    console.error('  ' + (await res.text()).slice(0, 500));
    process.exit(1);
  }
  const returned = res.headers.get('x-amz-meta-cid');
  console.log(`  HTTP ${res.status}`);
  console.log(`  返ってきた CID  ${returned ?? '(ヘッダに無し)'}`);
  console.log(`  自分の CID     ${ours.cid}`);
  console.log(`  ${returned === ours.cid ? c.ok('一致 — CID を保ったまま取り込まれた') : c.warn('食い違い。CAR として取り込まれていない可能性')}`);
}

// ── 4. 公開ゲートウェイから本当に引けるか ───────────────────────
if (check || upload) {
  head('4. 公開ゲートウェイから引く');
  console.log(`  ${c.dim('自分のマシンを経由せずに、外から本文が取れるかを確かめます。')}`);
  const first = files[0];
  const gateways = [
    // dweb.link は /ipfs/<CID> を <CID>.ipfs.dweb.link へ 301 で飛ばす。
    // サブドメインが無数に生える形なので、組織のネットワークが遮断していると届かない。
    // リダイレクトせずに 200 を返すものだけを候補にする (2026-08-26 実測)
    ['ipfs.io', `https://ipfs.io/ipfs/${ours.cid}/${first.name}`],
    ['filebase.io', `https://ipfs.filebase.io/ipfs/${ours.cid}/${first.name}`],
    ['pinata', `https://gateway.pinata.cloud/ipfs/${ours.cid}/${first.name}`],
  ];
  const results = [];
  for (const [name, url] of gateways) {
    const t0 = Date.now();
    try {
      const r = await fetch(url, {signal: AbortSignal.timeout(45000)});
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      // 取れたバイト列を自分で CID にし直す。中身がすり替わっていないかを見る
      const back = fileCid(buf);
      const ok = back.cid === first.cid;
      results.push({gateway: name, ok, bytes: buf.length, ms: Date.now() - t0});
      console.log(`  ${padTo(name, 14)} ${ok ? c.ok('取れて CID も一致') : c.ng('CID が違う')}  ` +
        `${buf.length.toLocaleString('en-US')} バイト  ${Date.now() - t0}ms`);
    } catch (e) {
      results.push({gateway: name, ok: false, error: e.message});
      console.log(`  ${padTo(name, 14)} ${c.ng(e.message.slice(0, 50))}`);
    }
  }
  var gatewayResults = results;
}

// ── 記録 ────────────────────────────────────────────────────────
if (!check) {
  const out = {
    generatedAt: new Date().toISOString(),
    uploaded: upload,
    note: upload
      ? 'Filebase に上げた。**Filebase 上のものは消せる**。取り消せないのは Arweave のほう'
      : 'CID を計算して CAR にしただけ。どこにも送っていない',
    directory: {cid: ours.cid, links: ours.links, dagSize: ours.dagSize},
    verifiedAgainst: `kubo ${ipfs('version', '--number')}`,
    car: {path: rel(CAR), bytes: fs.existsSync(CAR) ? fs.statSync(CAR).size : null},
    files: files.map((f) => ({name: f.name, bytes: f.bytes, cid: f.cid, codec: f.codec, chunks: f.chunks})),
    gateways: typeof gatewayResults !== 'undefined' ? gatewayResults : null,
    nextStep: upload
      ? `CorpusAnchor に sourceUri = ipfs://${ours.cid} で刻み直すと、root と本文の在り処が繋がる`
      : '--upload を付けると Filebase に上げます',
  };
  writeJson(path.join(OUT, 'ipfs.json'), out);
  console.log('');
  console.log(`  書き出し  ${rel(path.join(OUT, 'ipfs.json'))}`);
}

if (!upload && !check) {
  console.log('');
  console.log(c.warn('  下見なので、ここで終わります。外には何も送っていません。'));
}
