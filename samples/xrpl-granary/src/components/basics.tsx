import type { ReactNode } from 'react';

/**
 * 入門ページ専用の表示部品。
 *
 * 他のページより文字を大きく、行間を広く、1 画面あたりの情報量を減らしている。
 * 読み手がどこで詰まっても戻れるように、用語は出てきたその場で囲んで示す。
 */

/** 章。大きな番号と問いかけの見出し。 */
export function Chapter({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="scroll-mt-20 border-t border-border pt-10" id={`c${n}`}>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-2xl font-bold text-accent">{n}</span>
        <h2 className="text-lg font-bold leading-snug sm:text-xl">{title}</h2>
      </div>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

/** 本文。入門ページでは少し大きめ。 */
export function T({ children }: { children: ReactNode }) {
  return <p className="max-w-2xl text-[15px] leading-9">{children}</p>;
}

/** 一番言いたい一文 */
export function Key({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-2xl rounded-lg border-l-4 border-accent bg-accent-soft px-4 py-3 text-[15px] font-medium leading-9">
      {children}
    </p>
  );
}

/** たとえ話 */
export function Analogy({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-2xl rounded-lg border border-border bg-surface-2 p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">たとえるなら</p>
      <div className="mt-1.5 text-sm leading-8">{children}</div>
    </div>
  );
}

/** 用語をその場で説明する小箱 */
export function Word({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="max-w-2xl rounded border border-dashed border-accent/50 bg-surface p-3">
      <p className="text-xs leading-7">
        <span className="mr-2 rounded bg-accent-soft px-1.5 py-0.5 font-semibold text-accent">
          {term}
        </span>
        {children}
      </p>
    </div>
  );
}

/** 3 つの方式を並べるカード */
export function WayCard({
  name,
  rule,
  speed,
  power,
  note,
  analogy,
}: {
  name: string;
  rule: string;
  speed: string;
  power: string;
  note: string;
  analogy: string;
}) {
  return (
    <article className="rounded-lg border border-border bg-surface p-5">
      <h3 className="text-base font-semibold">{name}</h3>
      <p className="mt-2 text-sm leading-8">{rule}</p>
      <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs leading-7">
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-ink-soft">記録が増える間隔</dt>
          <dd className="font-medium">{speed}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-ink-soft">電気の使用</dt>
          <dd>{power}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-ink-soft">特徴</dt>
          <dd>{note}</dd>
        </div>
      </dl>
      <p className="mt-3 rounded bg-surface-2 p-2.5 text-xs leading-7">🏃 {analogy}</p>
    </article>
  );
}

/** 用語辞典の 1 項目 */
export function Term({ word, reading, children }: { word: string; reading?: string; children: ReactNode }) {
  return (
    <div className="border-b border-border/60 py-3 last:border-0">
      <dt className="text-sm font-semibold">
        {word}
        {reading && <span className="ml-2 text-[11px] font-normal text-ink-soft">{reading}</span>}
      </dt>
      <dd className="mt-1 text-xs leading-7 text-ink-soft">{children}</dd>
    </div>
  );
}
