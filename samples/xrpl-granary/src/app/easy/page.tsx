import type { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '@/components/ui';
import {
  FigDefaultRipple,
  FigRiceNoteFlow,
  FigTakerDirection,
  FigTrustLine,
  FigXrpVsToken,
} from '@/components/figures';
import {
  EASY_ANALOGY,
  EASY_INTRO,
  EASY_STEPS,
  EDO_WORDS,
  HISTORY_CAVEAT,
  ISSUER_NOTE,
} from '@/lib/easy';
import { BY_ID } from '@/lib/glossary';

export const metadata: Metadata = {
  title: 'はじめての人へ — 何をやっているのか',
  description:
    '専門語を前提にしない説明。XRPL のデモが何をしているのかを、江戸時代の米切手にたとえて 6 ステップで読む。',
};

/**
 * どのステップにどの図を出すか。
 * 図はひとつの関係だけを示すので、節ごとに最大 1 枚に絞る。
 */
function figureFor(n: string) {
  switch (n) {
    case '②':
      return <FigDefaultRipple />;
    case '③':
      return <FigTrustLine />;
    case '④':
      return <FigXrpVsToken />;
    case '⑤':
      return <FigTakerDirection />;
    default:
      return null;
  }
}

/** その節で出てくる言葉を、日常語の見出しで並べる */
function Words({ ids }: { ids: string[] }) {
  const entries = ids.map((id) => BY_ID[id]).filter(Boolean);
  if (entries.length === 0) return null;
  return (
    <dl className="mt-4 space-y-2 rounded border border-border bg-surface-2 px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">
        ここで出てくる言葉
      </p>
      {entries.map((e) => (
        <div key={e.id} className="text-xs leading-relaxed">
          <dt className="inline font-semibold text-accent">{e.plainTerm ?? e.term}</dt>
          <dd className="inline text-ink-soft">
            {' — '}
            {e.plain}{' '}
            <Link
              href={`/glossary#${e.id}`}
              className="whitespace-nowrap underline underline-offset-2 hover:text-accent"
            >
              正確な説明
            </Link>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function EasyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink-soft">
          専門語を前提にしない説明
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          はじめての人へ — 何をやっているのか
        </h1>
        <div className="mt-4 space-y-3">
          {EASY_INTRO.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-ink">
              {p}
            </p>
          ))}
        </div>
        <p className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link
            href="/"
            className="inline-flex items-center rounded border border-accent bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent"
          >
            デモを動かす →
          </Link>
          <Link
            href="/glossary"
            className="inline-flex items-center rounded border border-border px-3 py-1.5 text-xs font-medium text-ink-soft"
          >
            用語集と質問 →
          </Link>
        </p>
      </header>

      <Card title="たとえ話 — 大坂の米切手" hint="XRPL のトークンは、これとほぼ同じ仕組み">
        <div className="space-y-2.5">
          {EASY_ANALOGY.map((p, i) => (
            <p key={i} className="text-xs leading-relaxed text-ink">
              {p}
            </p>
          ))}
        </div>

        <FigRiceNoteFlow />

        <p className="mt-3 border-l-2 border-accent/40 pl-3 text-[11px] leading-relaxed text-ink-soft">
          <span className="font-semibold text-ink">よくある誤り</span> — {ISSUER_NOTE}
        </p>

        <dl className="mt-4 grid gap-x-6 gap-y-2 rounded border border-border bg-surface-2 px-4 py-3 sm:grid-cols-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-soft sm:col-span-2">
            出てくる江戸時代の言葉
          </p>
          {EDO_WORDS.map((w) => (
            <div key={w.word} className="text-[11px] leading-relaxed">
              <dt className="inline font-semibold text-accent">
                {w.word}
                <span className="ml-1 font-normal text-ink-soft">（{w.reading}）</span>
              </dt>
              <dd className="inline text-ink-soft">{' — '}{w.meaning}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <section className="mt-10">
        <h2 className="mb-1 text-lg font-bold tracking-tight">6 つのステップで何が起きるか</h2>
        <p className="mb-5 text-xs leading-relaxed text-ink-soft">
          デモの画面と同じ並び。左の丸数字が対応している。
        </p>

        <div className="space-y-4">
          {EASY_STEPS.map((s) => (
            <article key={s.n} className="rounded-lg border border-border bg-surface p-4 sm:p-5">
              <h3 className="text-sm font-semibold">
                <span className="mr-2 text-accent">{s.n}</span>
                {s.title}
              </h3>
              <p className="mt-0.5 text-[11px] text-ink-soft">
                画面上の表記: {s.realTitle}
              </p>

              <div className="mt-3 space-y-2.5">
                {s.body.map((p, i) => (
                  <p key={i} className="text-xs leading-relaxed text-ink">
                    {p}
                  </p>
                ))}
              </div>

              {figureFor(s.n)}

              <p className="mt-3 border-l-2 border-border pl-3 text-[11px] leading-relaxed text-ink-soft">
                <span className="font-semibold">専門的には</span> — {s.precise}
              </p>

              <Words ids={s.terms} />
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <Card
          title="このたとえ話が史実とずれているところ"
          hint="ファクトチェックで判明した点。隠さずに書いておく"
        >
          <div className="space-y-2.5">
            {HISTORY_CAVEAT.map((p, i) => (
              <p key={i} className="text-xs leading-relaxed text-ink">
                {p}
              </p>
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-6">
        <Card title="次にどうするか">
          <ul className="space-y-2 text-xs leading-relaxed">
            <li>
              ·{' '}
              <Link href="/" className="text-accent underline underline-offset-2">
                デモを動かす
              </Link>{' '}
              — 上の 6 つを実際に走らせる。60 秒ほど。失敗しても本物のお金は動かない。
            </li>
            <li>
              ·{' '}
              <Link href="/glossary" className="text-accent underline underline-offset-2">
                わからないとき
              </Link>{' '}
              — 用語 50 語とよくある質問 22 件。詰まったことを打ち込めば近いものを探す。
            </li>
            <li>
              ·{' '}
              <Link href="/learn" className="text-accent underline underline-offset-2">
                ゆっくり読む XRPL
              </Link>{' '}
              — もう一段くわしい説明。ふつうのシステムとの違い、他のブロックチェーンとの違い。
            </li>
          </ul>
        </Card>
      </section>
    </main>
  );
}
