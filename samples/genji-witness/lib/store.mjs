/**
 * 算出した値を手元に置く。
 *
 * チェーンに載るのは root 1 個 (32 バイト) だけなので、**現物を保存しておかないと
 * 「どこが変わったか」は永久に言えなくなる**。root が違うことは分かるが、
 * 54 帖 25,065 行のどこが違うかは分からない。
 *
 * ここでは本文そのものは複製しない (素材のリポジトリが持っている)。
 * 代わりに **帖ごとの digest と 25,065 件の葉ハッシュ**を置く。
 * これがあれば、後の版と突き合わせて「どの行が変わったか」を出せる。
 * 5.87 MB の本文を持たずに差分の場所が分かる、というのが Merkle ツリーの副産物。
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = path.join(ROOT, 'out');

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
  return file;
}

export function readJson(file, hint) {
  if (!fs.existsSync(file)) {
    console.error(`${rel(file)} がありません。先に ${hint} を実行してください。`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export const corpusFile = () => path.join(OUT, 'corpus.json');
export const leavesFile = () => path.join(OUT, 'leaves.json');
export const deployedFile = () => path.join(OUT, 'deployed.json');
export const anchoredFile = () => path.join(OUT, 'anchored.json');

export const readCorpusOut = () => readJson(corpusFile(), 'node scripts/01-digest.mjs');
export const readLeaves = () => readJson(leavesFile(), 'node scripts/01-digest.mjs');
export const readDeployed = () => readJson(deployedFile(), './scripts/dev.zsh');
export const readAnchored = () => readJson(anchoredFile(), 'node scripts/02-anchor.mjs');

export const rel = (p) => path.relative(ROOT, p);
