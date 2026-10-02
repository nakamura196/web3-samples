/**
 * 素材のリポジトリの場所。
 *
 * この試作は kouigenjimonogatari.github.io の作業コピーを**読むだけ**で、
 * 一切書き換えない。あちらは kouigenjimonogatari org の公開リポジトリなので、
 * 未確立の Web3 のコードを混ぜないよう、こちらから参照する形にしてある。
 *
 * 場所を変えたいときは環境変数で:
 *   GENJI_REPO=/path/to/kouigenjimonogatari.github.io node scripts/01-digest.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './store.mjs';

export const GENJI_REPO = process.env.GENJI_REPO
  ?? path.resolve(ROOT, '..', 'kouigenji');

export const MASTER_DIR = path.join(GENJI_REPO, 'xml', 'master');

export function requireRepo() {
  if (!fs.existsSync(MASTER_DIR)) {
    console.error(
      `xml/master が見つかりません: ${MASTER_DIR}\n` +
      'GENJI_REPO で場所を指定するか、次を実行してください:\n' +
      '  git clone https://github.com/kouigenjimonogatari/kouigenjimonogatari.github.io.git ../kouigenji'
    );
    process.exit(1);
  }
  return MASTER_DIR;
}

/** git の commit を出典として記録する。どの版を見たかを人が辿れる形 */
export function gitHead() {
  try {
    const head = fs.readFileSync(path.join(GENJI_REPO, '.git', 'HEAD'), 'utf8').trim();
    const ref = head.startsWith('ref: ') ? head.slice(5) : null;
    if (!ref) return {sha: head, ref: null};
    const loose = path.join(GENJI_REPO, '.git', ref);
    if (fs.existsSync(loose)) return {sha: fs.readFileSync(loose, 'utf8').trim(), ref};
    // clone 直後は ref がファイルではなく packed-refs にまとめられている
    const packed = fs.readFileSync(path.join(GENJI_REPO, '.git', 'packed-refs'), 'utf8');
    const hit = packed.split('\n').find((l) => l.endsWith(' ' + ref));
    return {sha: hit ? hit.split(' ')[0] : null, ref};
  } catch {
    return {sha: null, ref: null};
  }
}
