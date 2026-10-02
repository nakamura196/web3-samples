/**
 * 自由入力に答えるための照合。LLM は使わない。
 *
 * やっていることは検索である。あらかじめ書いておいた FAQ と用語集に対して、
 * 打ち込まれた文が一番近い項目を選んで返す。
 *
 * 日本語は空白で語が切れないので、形態素解析の代わりに文字バイグラムの
 * 重なり (Dice 係数) を使う。依存パッケージを増やさずに済み、
 * 「トラストラインって何」「信用線がわからない」のような揺れを吸収できる。
 * キーワードの直接一致はそれより強く効かせる。
 */

import { FAQ, type FaqEntry } from './faq.ts';
import { GLOSSARY, type GlossaryEntry } from './glossary.ts';

// ── 正規化 ──────────────────────────────────────────────────────

/** 全角英数を半角に落とす。ＸＲＰ と XRP を同じものとして扱うため */
function toHalfWidth(s: string): string {
  return s.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/** 照合に効かない文字を落とす。助詞は残す (バイグラムの側で薄まる) */
function normalize(s: string): string {
  return toHalfWidth(s)
    .toLowerCase()
    .replace(/[\s　]+/g, '')
    .replace(/[。、．，,.!?！？「」『』()（）\[\]【】:：;；"'`*_\-—–~〜]/g, '');
}

function bigrams(s: string): Set<string> {
  const t = normalize(s);
  const out = new Set<string>();
  if (t.length === 0) return out;
  if (t.length === 1) {
    out.add(t);
    return out;
  }
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

/** Dice 係数。0〜1 で、1 が完全一致 */
function dice(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const g of a) if (b.has(g)) shared++;
  return (2 * shared) / (a.size + b.size);
}

// ── 採点 ────────────────────────────────────────────────────────

export type HitKind = 'faq' | 'term';

export interface Hit {
  kind: HitKind;
  id: string;
  /** 一覧に出す見出し */
  title: string;
  /** 一覧に出す一行 */
  lead: string;
  score: number;
  faq?: FaqEntry;
  term?: GlossaryEntry;
}

/** これを下回ったら「近いものが見つからない」として扱う */
const CONFIDENCE_FLOOR = 0.17;

export interface AnswerResult {
  hits: Hit[];
  /** 十分に近い答えがあったか */
  confident: boolean;
}

/**
 * 打ち込まれた文に一番近い項目を返す。
 *
 * FAQ を用語より優先する。「トラストラインとは」なら用語で足りるが、
 * 「なぜ信用線が要るのか」は FAQ でしか答えられないため。
 */
export function findAnswers(query: string, limit = 4): AnswerResult {
  const q = normalize(query);
  if (q.length === 0) return { hits: [], confident: false };
  const qg = bigrams(query);

  const hits: Hit[] = [];

  for (const f of FAQ) {
    // 質問文との近さが主。本文は薄く効かせる
    let score = dice(qg, bigrams(f.q)) * 1.0 + dice(qg, bigrams(f.a.join(''))) * 0.15;

    // キーワードが打たれた文にそのまま含まれていれば強く加点。
    // 長いキーワードほど偶然の一致が起きにくいので重く見る。
    for (const k of f.keywords) {
      const nk = normalize(k);
      if (nk.length >= 2 && q.includes(nk)) score += 0.1 + nk.length * 0.02;
    }

    hits.push({ kind: 'faq', id: f.id, title: f.q, lead: f.a[0], score, faq: f });
  }

  for (const t of GLOSSARY) {
    let score = dice(qg, bigrams(t.short)) * 0.35;

    // 用語そのものが打たれていれば強い手がかり
    for (const label of [t.term, ...(t.aliases ?? []), t.reading ?? '']) {
      const nl = normalize(label);
      if (nl.length >= 2 && q.includes(nl)) score += 0.22 + nl.length * 0.015;
    }
    // 「〜とは」「〜って何」のような聞き方は用語の定義を求めている
    if (/とは|って何|ってなに|とはなに|の意味|意味は|わからない|分からない/.test(q)) {
      score *= 1.25;
    }

    hits.push({ kind: 'term', id: t.id, title: t.term, lead: t.short, score, term: t });
  }

  hits.sort((a, b) => b.score - a.score);
  const top = hits.filter((h) => h.score > 0.02).slice(0, limit);
  return { hits: top, confident: top.length > 0 && top[0].score >= CONFIDENCE_FLOOR };
}

/** 何も打たれていないときに出す取っ掛かり */
export const STARTER_QUESTIONS: string[] = [
  'XRP を送るのとトークンを発行するのは何が違う？',
  'なぜ TrustSet が必要なの？',
  'tecPATH_DRY が出た',
  'TakerGets と TakerPays がわからない',
  '手数料は誰が受け取るの？',
  'Bitcoin とどう違う？',
];
