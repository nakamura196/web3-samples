/**
 * 「このアドレスは私のものだ」と、現実の側から宣言する文を作る。
 *
 *   op run --env-file=.env.local -- node scripts/12-declare.mjs
 *
 * ── なぜ要るのか ────────────────────────────────────────────────
 * チェーンは「この鍵の持ち主が中村覚である」を確かめられない。オラクル問題の一種で、
 * チェーンの内側だけでは解けない。
 *
 * ただし身元には抜け道がある。**本人が既に持っている場所から宣言できる**からである。
 * 必要なのは**双方向のリンク**で、片方向だと成立しない。
 *
 *   チェーン → 現実   sourceUri に GitHub の URL      ← 07/09 で入れた
 *   現実 → チェーン   サイト側にアドレスを書く          ← これを作る
 *
 * 誰でも sourceUri に東大の URL を書ける。だから逆向きが要る。
 * 資料の公式サイトを更新できる人だけが、そこにアドレスを置ける。
 *
 * さらに **署名を付ける**と、「サイトを書き換えられる人」に加えて
 * 「鍵を実際に持っている人」であることまで示せる。片方だけでは作れない。
 *
 * ── 身元が要る主張と、要らない主張 ──────────────────────────────
 * ここは混ぜないこと。
 *
 *   「この版は改竄されていない」      身元は要らない。独立した N 人が同じ root を
 *                                 刻めば足りる。**匿名の証人でも数として効く**
 *   「東大史料編纂所が公式に認めた版」 身元が要る。誰が言ったかが主張の中身そのもの
 *
 * CorpusAnchor が担うのは前者である。この宣言文は後者のためにある。
 *
 * ── 出力の置き場所 ──────────────────────────────────────────────
 * out/well-known/ に書く。**このスクリプトは何も送信せず、別のリポジトリにも触らない。**
 * 置くかどうか、どこに置くかは人が決める。
 */
import {signMessage, addressOf} from '../lib/tx.mjs';
import {readCorpusOut, readJson, writeJson, OUT, rel} from '../lib/store.mjs';
import {c, rule, head} from '../lib/ui.mjs';
import fs from 'node:fs';
import path from 'node:path';

const priv = process.env.SEPOLIA_PRIVATE_KEY;
if (!priv || priv.startsWith('op://')) {
  console.error(c.ng('SEPOLIA_PRIVATE_KEY がありません (op run を通していますか)'));
  process.exit(1);
}
const ME = addressOf(priv);
const corpus = readCorpusOut();
const sepolia = readJson(path.join(OUT, 'sepolia.json'), 'node scripts/07-sepolia.mjs --send');
const ipfs = readJson(path.join(OUT, 'ipfs.json'), 'node scripts/08-ipfs.mjs --upload');
const publish = (() => { try { return readJson(path.join(OUT, 'publish.json')); } catch { return null; } })();

rule('アドレスの持ち主を、現実の側から宣言する');
console.log(`  ${c.warn('このスクリプトは何も送信しません。ファイルを作るだけです。')}`);
console.log(`  ${c.dim('kouigenjimonogatari リポジトリには触りません。置くかは人が決めます。')}`);

// 署名する本文。**人が読んで意味が分かる文**にする。
// 機械可読な JSON に署名すると、空白やキー順が変わっただけで検証が落ちる。
const statement = [
  'I am Satoru Nakamura (中村 覚), Associate Professor at the Historiographical Institute,',
  'The University of Tokyo, and the maintainer of 校異源氏物語 (Kouigenji Monogatari).',
  '',
  `I control the Ethereum address ${ME}.`,
  '',
  'Records anchored from this address on Sepolia (chainId 11155111):',
  `  CorpusAnchor contract: ${sepolia.corpusAnchor}`,
  `  chapter tree root:     ${corpus.trees.chapter.root} (${corpus.trees.chapter.treeSize} leaves)`,
  `  item tree root:        ${corpus.trees.item.root} (${corpus.trees.item.treeSize} leaves)`,
  `  source commit:         ${corpus.source.commit}`,
  `  IPFS:                  ipfs://${ipfs.directory.cid}`,
  publish ? `  Ocean data NFT:        ${publish.nft}` : '',
  publish ? `  DID:                   ${publish.did}` : '',
  '',
  'The TEI data is licensed CC0-1.0. Anyone may verify these roots independently',
  'by running scripts/01-digest.mjs against the source commit above.',
].filter((l) => l !== undefined).join('\n');

head('署名する本文');
console.log(statement.split('\n').map((l) => '  ' + c.dim(l)).join('\n'));

const signed = signMessage(statement, priv);

head('署名');
console.log(`  アドレス   ${signed.address}`);
console.log(`  ハッシュ   ${signed.hash}  ${c.dim('(EIP-191)')}`);
console.log(`  署名       ${signed.signature.slice(0, 42)}…  ${c.dim(`${(signed.signature.length - 2) / 2} バイト`)}`);

// ── 出力 ────────────────────────────────────────────────────────
const dir = path.join(OUT, 'well-known');
fs.mkdirSync(dir, {recursive: true});

const doc = {
  '$comment': 'Signed declaration binding a real-world identity to an Ethereum address. '
    + 'Verify with: cast wallet verify --address <address> <message> <signature>',
  version: 1,
  identity: {
    name: 'Satoru Nakamura / 中村 覚',
    affiliation: 'Historiographical Institute, The University of Tokyo',
    orcid: null,
    homepage: 'https://kouigenjimonogatari.github.io/',
  },
  address: ME,
  chains: [{
    chainId: 11155111, name: 'sepolia',
    corpusAnchor: sepolia.corpusAnchor,
    oceanDataNft: publish?.nft ?? null,
    did: publish?.did ?? null,
  }],
  corpus: {
    corpusId: corpus.corpusId,
    sourceCommit: corpus.source.commit,
    sourceUri: corpus.source.sourceUri,
    ipfs: `ipfs://${ipfs.directory.cid}`,
    trees: {
      chapter: {root: corpus.trees.chapter.root, treeSize: corpus.trees.chapter.treeSize,
        spec: corpus.trees.chapter.spec},
      item: {root: corpus.trees.item.root, treeSize: corpus.trees.item.treeSize,
        spec: corpus.trees.item.spec},
    },
  },
  statement,
  signature: signed.signature,
  signatureScheme: 'EIP-191 personal_sign',
};
writeJson(path.join(dir, 'genji-witness.json'), doc);
fs.writeFileSync(path.join(dir, 'genji-witness.txt'),
  statement + '\n\n-----\nAddress:   ' + ME + '\nSignature: ' + signed.signature + '\n');

head('作ったファイル');
console.log(`  ${rel(path.join(dir, 'genji-witness.json'))}  ${c.dim('機械が読む用')}`);
console.log(`  ${rel(path.join(dir, 'genji-witness.txt'))}   ${c.dim('人が読む用')}`);
console.log('');
console.log('  置き場所の候補 (権威の強い順):');
console.log(`    ${c.dim('hi.u-tokyo.ac.jp の職員ページ  ← 大学が管理するドメイン。いちばん強い')}`);
console.log(`    ${c.dim('kouigenjimonogatari.github.io/.well-known/genji-witness.json')}`);
console.log(`    ${c.dim('ORCID のプロフィール / GitHub のプロフィール')}`);
console.log('');
console.log('  検証のしかた (誰でもできる):');
console.log(`    ${c.dim('cast wallet verify --address ' + ME + ' "$(cat genji-witness.txt)" <signature>')}`);
console.log('');
console.log(c.warn('  何も送信していません。コミットもしていません。'));
