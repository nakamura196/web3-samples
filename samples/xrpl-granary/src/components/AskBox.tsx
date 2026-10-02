'use client';

/**
 * 質問に答える箱。
 *
 * 打ち込まれた文に一番近い項目を、あらかじめ用意した FAQ と用語集から探して出す。
 * LLM は呼ばない。呼ばなくても「その場で組み立てているような動き」は作れる —
 * 原典のデモ (xrpl-ubc-demo) の Generate Code も、実体はテンプレートへの
 * 値の差し込みと表示の演出だった。
 *
 * ただし演出で誤解させない。仕組みは画面に書いておく。
 */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { STARTER_QUESTIONS, findAnswers, type AnswerResult, type Hit } from '@/lib/answer';
import { usePrefersReducedMotion } from './hooks';
import { Term, renderInline } from './Term';

/** 1 段落ずつ現れる。段落の途中で切らないので `等幅` の記法が壊れない */
function Paragraphs({ items, animate }: { items: string[]; animate: boolean }) {
  const [shown, setShown] = useState(animate ? 0 : items.length);

  useEffect(() => {
    if (!animate) return;
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= items.length) clearInterval(timer);
    }, 220);
    return () => clearInterval(timer);
  }, [animate, items.length]);

  return (
    <div className="space-y-2.5">
      {items.slice(0, shown).map((p, i) => (
        <p key={i} className="animate-fade-in text-xs leading-relaxed text-ink">
          {renderInline(p, `a${i}`)}
        </p>
      ))}
      {shown < items.length && (
        <p className="text-xs text-ink-soft">
          <span className="inline-block h-3 w-1.5 animate-pulse bg-accent align-middle" />
        </p>
      )}
    </div>
  );
}

function HitBody({ hit, animate }: { hit: Hit; animate: boolean }) {
  if (hit.kind === 'faq' && hit.faq) {
    return (
      <>
        <Paragraphs key={hit.faq.id} items={hit.faq.a} animate={animate} />
        {hit.faq.terms && hit.faq.terms.length > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-2.5 text-[11px] text-ink-soft">
            <span className="text-[10px]">関連する用語:</span>
            {hit.faq.terms.map((t) => (
              <Term key={t} id={t} />
            ))}
          </p>
        )}
      </>
    );
  }
  if (hit.term) {
    return (
      <>
        <Paragraphs
          key={hit.term.id}
          items={[hit.term.short, ...hit.term.long]}
          animate={animate}
        />
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2.5 text-[11px]">
          <Link
            href={`/glossary#${hit.term.id}`}
            className="text-accent underline underline-offset-2"
          >
            用語集で見る
          </Link>
          {hit.term.href && (
            <a
              href={hit.term.href}
              target="_blank"
              rel="noreferrer"
              className="text-ink-soft underline underline-offset-2 hover:text-accent"
            >
              一次資料
            </a>
          )}
        </p>
      </>
    );
  }
  return null;
}

export function AskBox() {
  const [input, setInput] = useState('');
  const [asked, setAsked] = useState('');
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const animate = !usePrefersReducedMotion();

  const ask = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const r = findAnswers(trimmed);
    setAsked(trimmed);
    setResult(r);
    setOpenId(r.hits[0]?.id ?? null);
  }, []);

  const top = result?.hits[0];
  const rest = result?.hits.slice(1) ?? [];

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex gap-2"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="わからない語や、詰まったことを書く"
          aria-label="質問を入力"
          className="min-w-0 flex-1 rounded border border-border bg-surface px-3 py-2 text-xs text-ink outline-none placeholder:text-ink-soft/70 focus:border-accent"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="shrink-0 rounded border border-accent bg-accent-soft px-3 py-2 text-xs font-medium text-accent disabled:opacity-40"
        >
          調べる
        </button>
      </form>

      {!result && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {STARTER_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => {
                setInput(q);
                ask(q);
              }}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] text-ink-soft hover:border-accent hover:text-accent"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {result && (
        <div className="mt-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-ink-soft">
            「{asked}」に近いもの
          </p>

          {!result.confident && (
            <div className="mb-3 rounded border border-warn/40 bg-surface-2 p-3 text-xs leading-relaxed">
              <p className="font-medium text-warn">近い答えが用意されていない。</p>
              <p className="mt-1 text-ink-soft">
                下は一応近そうな候補。外していたら
                <Link href="/glossary" className="text-accent underline underline-offset-2">
                  用語集
                </Link>
                を眺めるか、その場にいる人に聞くのが早い。この箱は用意された回答から探しているだけなので、
                想定していない質問には答えられない。
              </p>
            </div>
          )}

          {top && (
            <div className="rounded-lg border border-accent/40 bg-surface p-4">
              <h3 className="mb-2.5 text-sm font-semibold text-ink">{top.title}</h3>
              <HitBody hit={top} animate={animate} />
            </div>
          )}

          {rest.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] text-ink-soft">ほかの候補</p>
              <ul className="space-y-1.5">
                {rest.map((h) => (
                  <li key={`${h.kind}-${h.id}`} className="rounded border border-border bg-surface">
                    <button
                      onClick={() => setOpenId(openId === h.id ? null : h.id)}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left"
                    >
                      <span className="mt-px shrink-0 font-mono text-[9px] uppercase tracking-wider text-ink-soft">
                        {h.kind === 'faq' ? 'Q' : '語'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium text-ink">{h.title}</span>
                        {openId !== h.id && (
                          <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-ink-soft">
                            {h.lead.replace(/[`*]/g, '')}
                          </span>
                        )}
                      </span>
                    </button>
                    {openId === h.id && (
                      <div className="border-t border-border px-3 py-2.5">
                        <HitBody hit={h} animate={false} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => {
              setResult(null);
              setInput('');
              inputRef.current?.focus();
            }}
            className="mt-3 text-[11px] text-ink-soft underline underline-offset-2 hover:text-accent"
          >
            別のことを調べる
          </button>
        </div>
      )}
    </div>
  );
}
