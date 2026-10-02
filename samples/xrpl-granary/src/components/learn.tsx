import type { ReactNode } from 'react';

/** 章。番号・見出し・導入文の 3 点セットで、読む速度を落とす。 */
export function Section({
  n,
  title,
  lead,
  children,
}: {
  n: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="scroll-mt-20 border-t border-border pt-10" id={`s${n}`}>
      <p className="font-mono text-[11px] uppercase tracking-widest text-ink-soft">
        {n === '0' ? 'はじめに' : `第 ${n} 章`}
      </p>
      <h2 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
      {lead && <div className="mt-3 max-w-2xl text-sm leading-8 text-ink-soft">{lead}</div>}
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );
}

/** 本文。1 段落 = 1 つの考え、を守るための箱。 */
export function P({ children }: { children: ReactNode }) {
  return <p className="max-w-2xl text-sm leading-8">{children}</p>;
}

/** 強調したい一文。読み飛ばされたくないところだけに使う。 */
export function Lead({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-2xl border-l-2 border-accent pl-4 text-sm font-medium leading-8">
      {children}
    </p>
  );
}

/** 補足・注意。本筋から少し外れるが、知らないと誤解する話。 */
export function Note({
  label = 'ひとこと',
  tone = 'neutral',
  children,
}: {
  label?: string;
  tone?: 'neutral' | 'warn';
  children: ReactNode;
}) {
  return (
    <aside
      className={`max-w-2xl rounded border-l-2 bg-surface-2 p-4 ${
        tone === 'warn' ? 'border-warn' : 'border-border'
      }`}
    >
      <p
        className={`font-mono text-[10px] uppercase tracking-widest ${
          tone === 'warn' ? 'text-warn' : 'text-ink-soft'
        }`}
      >
        {label}
      </p>
      <div className="mt-1.5 text-xs leading-7">{children}</div>
    </aside>
  );
}

/** デモの 1 ステップを、ゆっくり分解して見せる */
export function StepCard({
  n,
  title,
  tldr,
  children,
}: {
  n: string;
  title: string;
  tldr: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="rounded-lg border border-border bg-surface p-5">
      <h3 className="text-base font-semibold">
        <span className="mr-2 text-accent">{n}</span>
        {title}
      </h3>
      <p className="mt-2 text-sm leading-7">{tldr}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </article>
  );
}

/** 「普通のやり方」と「XRPL のやり方」を並べる */
export function Pair({ ordinary, xrpl }: { ordinary: ReactNode; xrpl: ReactNode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded border border-border bg-surface-2 p-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">
          普通のやり方
        </p>
        <p className="mt-1.5 text-xs leading-7">{ordinary}</p>
      </div>
      <div className="rounded border border-accent/40 bg-accent-soft p-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">XRPL</p>
        <p className="mt-1.5 text-xs leading-7">{xrpl}</p>
      </div>
    </div>
  );
}

/** ラベル付きの短い解説 */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="text-xs leading-7">
      <span className="mr-2 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-ink-soft">
        {label}
      </span>
      {children}
    </div>
  );
}

/** 横スクロールする比較表 */
export function Table({
  head,
  rows,
  firstColWidth = '10rem',
}: {
  head: string[];
  rows: ReactNode[][];
  firstColWidth?: string;
}) {
  return (
    <div className="scroll-x rounded border border-border bg-surface">
      <table className="w-full min-w-[44rem] text-left text-xs">
        <thead>
          <tr className="border-b border-border bg-surface-2">
            {head.map((h, i) => (
              <th
                key={h}
                className={`px-3 py-2 font-semibold ${i === 0 ? 'text-ink-soft' : 'text-accent'}`}
                style={i === 0 ? { width: firstColWidth } : undefined}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/50 align-top last:border-0">
              {r.map((c, j) => (
                <td
                  key={j}
                  className={`px-3 py-2.5 leading-6 ${j === 0 ? 'font-medium text-ink-soft' : ''}`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 番号付きの誤解リスト */
export function Myth({ claim, children }: { claim: string; children: ReactNode }) {
  return (
    <div className="max-w-2xl rounded border border-border bg-surface p-4">
      <p className="text-sm font-medium">
        <span className="mr-1.5 text-err">✗</span>
        「{claim}」
      </p>
      <div className="mt-2 text-xs leading-7 text-ink-soft">{children}</div>
    </div>
  );
}
