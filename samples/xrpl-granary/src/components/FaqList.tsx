'use client';

/** よくある質問の一覧。カテゴリごとに畳んで並べる */

import { useEffect, useState } from 'react';
import { FAQ, FAQ_CATEGORY_LABEL, FAQ_CATEGORY_ORDER } from '@/lib/faq';
import { useHash } from './hooks';
import { Term, renderInline } from './Term';

export function FaqList() {
  const hash = useHash();
  const fromHash = FAQ.some((f) => f.id === hash) ? hash : '';
  const [touched, setTouched] = useState<Set<string> | null>(null);
  const open = touched ?? new Set(fromHash ? [fromHash] : []);

  useEffect(() => {
    if (!fromHash || touched) return;
    document.getElementById(fromHash)?.scrollIntoView({ block: 'center' });
  }, [fromHash, touched]);

  const toggle = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTouched(next);
  };

  return (
    <div className="space-y-8">
      {FAQ_CATEGORY_ORDER.map((cat) => {
        const items = FAQ.filter((f) => f.category === cat);
        if (items.length === 0) return null;
        return (
          <section key={cat}>
            <h2 className="mb-2.5 font-mono text-[10px] uppercase tracking-widest text-ink-soft">
              {FAQ_CATEGORY_LABEL[cat]}
            </h2>
            <ul className="space-y-2">
              {items.map((f) => {
                const isOpen = open.has(f.id);
                return (
                  <li
                    key={f.id}
                    id={f.id}
                    className={`scroll-mt-28 rounded-lg border bg-surface ${
                      isOpen ? 'border-accent/40' : 'border-border'
                    }`}
                  >
                    <button
                      onClick={() => toggle(f.id)}
                      aria-expanded={isOpen}
                      className="flex w-full items-start gap-2.5 px-4 py-3 text-left"
                    >
                      <span className="mt-px shrink-0 font-mono text-[11px] text-accent">Q</span>
                      <span className="flex-1 text-xs font-medium leading-relaxed text-ink">
                        {f.q}
                      </span>
                      <span className="shrink-0 text-ink-soft">{isOpen ? '−' : '+'}</span>
                    </button>

                    {isOpen && (
                      <div className="border-t border-border px-4 py-3 pl-[2.9rem]">
                        <div className="space-y-2.5">
                          {f.a.map((p, i) => (
                            <p key={i} className="text-xs leading-relaxed text-ink">
                              {renderInline(p, `${f.id}-${i}`)}
                            </p>
                          ))}
                        </div>
                        {f.terms && f.terms.length > 0 && (
                          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-2.5 text-[11px] text-ink-soft">
                            <span className="text-[10px]">関連する用語:</span>
                            {f.terms.map((t) => (
                              <Term key={t} id={t} />
                            ))}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
