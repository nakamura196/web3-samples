/**
 * カタログアプリが読む一覧を書き出す。**これが索引サーバの代わり。**
 *
 *   node scripts/18-registry.mjs
 *
 * ── 何を渡すのか ────────────────────────────────────────────────
 * 渡すのは **アドレスと、どのブロックから探せばよいか**だけ。
 * 名前も説明も root も渡さない。それらはチェーンから読めるからである。
 *
 * Aquarius が持っているのは「検索を速くするための複製」で、
 * それが 503 を返すと Market は 0 件になった。ここで渡すのは複製ではなく
 * **入口の一覧**なので、これが古くなってもチェーン側の記録は失われない。
 *
 * 無料の公開 RPC は 1 回 50,000 ブロックまでしか受けないので、
 * 「どこから探すか」を持っていることが実用上とても効く。
 */
import {readJson, writeJson, OUT, ROOT, rel} from '../lib/store.mjs';
import {c, rule, head} from '../lib/ui.mjs';
import fs from 'node:fs';
import path from 'node:path';

const sepolia = readJson(path.join(OUT, 'sepolia.json'), 'node scripts/07-sepolia.mjs --send');
const whole = readJson(path.join(OUT, 'publish.json'), 'node scripts/11-publish.mjs --send');
const ipfs = readJson(path.join(OUT, 'ipfs.json'), 'node scripts/08-ipfs.mjs --upload');
const vols = readJson(path.join(OUT, 'volumes.json'), 'node scripts/16-publish-volumes.mjs --send');

const numbers = Object.keys(vols.volumes).map(Number).sort((a, b) => a - b);

const registry = {
  $comment: 'カタログアプリが読む入口の一覧。名前も root も入れない (チェーンから読めるので)。'
    + ' 入れてあるのはアドレスと、どのブロックから探せばよいか。'
    + ' node scripts/18-registry.mjs が書き出す。',
  generatedAt: new Date().toISOString(),
  chainId: 11155111,
  corpusAnchor: sepolia.corpusAnchor,
  corpusAnchorFromBlock: Math.min(...sepolia.transactions.map((t) => t.block)),
  publisher: whole.publisher,
  assets: [
    {
      nft: whole.nft, datatoken: whole.datatoken, did: whole.did,
      fromBlock: sepolia.transactions[sepolia.transactions.length - 1].block,
      slug: 'all',
      label: {ja: '校異源氏物語 全 54 帖', en: 'Kouigenji Monogatari, all 54 volumes'},
      ipfsCid: ipfs.directory.cid,
    },
    ...numbers.map((n) => {
      const v = vols.volumes[n];
      return {
        nft: v.nft, datatoken: v.datatoken, did: v.did,
        fromBlock: v.block,
        slug: String(n).padStart(2, '0'),
        label: {ja: `${v.title}（第${n}帖）`, en: `Volume ${n}: ${v.title}`},
        ipfsCid: v.ipfsCid,
      };
    }),
  ],
};

rule('カタログの入口一覧を書き出す');
head('中身');
console.log(`  資産        ${registry.assets.length} 件 (全体 1 + 帖 ${numbers.length})`);
console.log(`  CorpusAnchor ${registry.corpusAnchor}  ${c.dim(`block ${registry.corpusAnchorFromBlock} 以降`)}`);
console.log(`  ${c.dim('名前も root も入れていません。チェーンから読めるものは渡しません。')}`);

const dest = path.resolve(ROOT, '..', 'genji-x', 'src', 'data', 'registry.json');
if (fs.existsSync(path.dirname(dest))) {
  writeJson(dest, registry);
  console.log(`\n  書き出し    ${dest}`);
} else {
  writeJson(path.join(OUT, 'registry.json'), registry);
  console.log(`\n  ${c.warn('genji-catalog が見つからないので out/ に書きました')}`);
  console.log(`  ${rel(path.join(OUT, 'registry.json'))}`);
}
