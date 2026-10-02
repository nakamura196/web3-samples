import type { ReactNode } from 'react';

/** プロトコル 1 つぶんの紹介カード */
export function ProtocolCard({
  name,
  year,
  tagline,
  good,
  bad,
  apps,
  dh,
}: {
  name: string;
  year: string;
  tagline: string;
  good: string[];
  bad: string[];
  apps: string;
  dh: string;
}) {
  return (
    <article className="rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-base font-semibold">{name}</h3>
        <span className="font-mono text-[10px] text-ink-soft">{year}</span>
      </div>
      <p className="mt-1.5 text-sm leading-7">{tagline}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-ok">得意</p>
          <ul className="mt-1.5 space-y-1 text-xs leading-6">
            {good.map((g) => (
              <li key={g}>· {g}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-warn">苦手</p>
          <ul className="mt-1.5 space-y-1 text-xs leading-6">
            {bad.map((b) => (
              <li key={b}>· {b}</li>
            ))}
          </ul>
        </div>
      </div>

      <dl className="mt-4 space-y-2 border-t border-border pt-3 text-xs leading-6">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">
            向いているアプリ
          </dt>
          <dd className="mt-0.5">{apps}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-widest text-accent">
            この分野での使いどころ
          </dt>
          <dd className="mt-0.5">{dh}</dd>
        </div>
      </dl>
    </article>
  );
}

/** 分野ごとの現状と、変わること・変わらないこと */
export function FieldCard({
  title,
  pain,
  changes,
  unchanged,
}: {
  title: string;
  pain: ReactNode;
  changes: ReactNode;
  unchanged: ReactNode;
}) {
  return (
    <article className="rounded-lg border border-border bg-surface p-5">
      <h3 className="text-base font-semibold">{title}</h3>
      <dl className="mt-3 space-y-3 text-xs leading-7">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">いまの痛み</dt>
          <dd className="mt-1">{pain}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-widest text-ok">台帳で変わること</dt>
          <dd className="mt-1">{changes}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-widest text-warn">
            台帳では変わらないこと
          </dt>
          <dd className="mt-1">{unchanged}</dd>
        </div>
      </dl>
    </article>
  );
}

/** 具体的なアプリ案 1 件 */
export function IdeaCard({
  n,
  title,
  stack,
  level,
  what,
  why,
  minimal,
  pitfall,
  recommend = 'yes',
}: {
  n: number;
  title: string;
  stack: string;
  level: '低' | '中' | '高';
  what: ReactNode;
  why: ReactNode;
  minimal: ReactNode;
  pitfall: ReactNode;
  recommend?: 'yes' | 'careful' | 'no';
}) {
  const tone =
    recommend === 'no'
      ? 'border-err/40'
      : recommend === 'careful'
        ? 'border-warn/40'
        : 'border-border';
  const badge =
    recommend === 'no' ? '勧めない' : recommend === 'careful' ? '条件つき' : '筋がよい';
  const badgeTone =
    recommend === 'no' ? 'text-err' : recommend === 'careful' ? 'text-warn' : 'text-ok';

  return (
    <article className={`rounded-lg border bg-surface p-5 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-semibold">
          <span className="mr-2 font-mono text-sm text-accent">{String(n).padStart(2, '0')}</span>
          {title}
        </h3>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`font-mono text-[10px] ${badgeTone}`}>{badge}</span>
          <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-ink-soft">
            難度 {level}
          </span>
        </div>
      </div>

      <p className="mt-1.5 font-mono text-[11px] text-ink-soft">{stack}</p>
      <p className="mt-3 text-xs leading-7">{what}</p>

      <dl className="mt-3 space-y-2 border-t border-border pt-3 text-xs leading-7">
        <div className="sm:flex sm:gap-3">
          <dt className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-ink-soft sm:w-24 sm:pt-1.5">
            なぜそれ
          </dt>
          <dd>{why}</dd>
        </div>
        <div className="sm:flex sm:gap-3">
          <dt className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-ink-soft sm:w-24 sm:pt-1.5">
            最小構成
          </dt>
          <dd>{minimal}</dd>
        </div>
        <div className="sm:flex sm:gap-3">
          <dt className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-warn sm:w-24 sm:pt-1.5">
            落とし穴
          </dt>
          <dd>{pitfall}</dd>
        </div>
      </dl>
    </article>
  );
}

/** 「要るか要らないか」の判定を階段状に見せる */
export function DecisionStep({
  q,
  yes,
  n,
}: {
  n: number;
  q: string;
  yes: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border font-mono text-[11px] text-ink-soft">
        {n}
      </span>
      <div className="text-xs leading-7">
        <p className="font-medium">{q}</p>
        <p className="mt-0.5 text-ink-soft">
          <span className="mr-1 text-ok">はい →</span>
          {yes}
        </p>
      </div>
    </li>
  );
}
