'use client';

/**
 * 用語集の一覧。検索とカテゴリ絞り込み、URL の #id での直リンクに対応する。
 * ポップオーバー (Term) から「用語集で見る」で飛んできたときに、
 * その項目が開いた状態になるようにしてある。
 */

import { useEffect, useMemo, useState } from 'react';
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  GLOSSARY,
  searchGlossary,
  type TermCategory,
} from '@/lib/glossary';
import { useHash } from './hooks';
import { Term, renderInline } from './Term';

export function GlossaryBrowser() {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<TermCategory | 'all'>('all');

  // #id で来たときは、その項目を開いた状態から始める。
  // 開閉状態を state に写さず導出しておくと、効果の中で setState せずに済む。
  const hash = useHash();
  const [touched, setTouched] = useState<Set<string> | null>(null);
  const open = touched ?? new Set(hash ? [hash] : []);

  // 展開は描画側で済んでいるので、ここは位置合わせだけ
  useEffect(() => {
    if (!hash || touched) return;
    document.getElementById(hash)?.scrollIntoView({ block: 'center' });
  }, [hash, touched]);

  const found = useMemo(() => searchGlossary(query), [query]);
  const visible = useMemo(
    () => (cat === 'all' ? found : found.filter((e) => e.category === cat)),
    [found, cat],
  );

  const grouped = useMemo(
    () =>
      CATEGORY_ORDER.map((c) => ({
        cat: c,
        items: visible.filter((e) => e.category === c),
      })).filter((g) => g.items.length > 0),
    [visible],
  );

  const toggle = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTouched(next);
  };

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`${GLOSSARY.length} 語から探す — 読みでも別名でも本文でも当たる`}
          aria-label="用語を検索"
          className="w-full rounded border border-border bg-surface px-3 py-2 text-xs text-ink outline-none placeholder:text-ink-soft/70 focus:border-accent"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            onClick={() => setCat('all')}
            className={`rounded-full border px-2.5 py-1 text-[11px] ${
              cat === 'all'
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border text-ink-soft hover:border-accent'
            }`}
          >
            すべて
          </button>
          {CATEGORY_ORDER.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${
                cat === c
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border text-ink-soft hover:border-accent'
              }`}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 && (
        <p className="mt-8 text-xs text-ink-soft">
          「{query}」に当たる語は無い。別の言い方を試すか、絞り込みを外す。
        </p>
      )}

      <div className="mt-6 space-y-8">
        {grouped.map((g) => (
          <section key={g.cat}>
            <h2 className="mb-2.5 font-mono text-[10px] uppercase tracking-widest text-ink-soft">
              {CATEGORY_LABEL[g.cat]}
            </h2>
            <ul className="space-y-2">
              {g.items.map((e) => {
                const isOpen = open.has(e.id);
                return (
                  <li
                    key={e.id}
                    id={e.id}
                    className={`scroll-mt-28 rounded-lg border bg-surface ${
                      isOpen ? 'border-accent/40' : 'border-border'
                    }`}
                  >
                    <button
                      onClick={() => toggle(e.id)}
                      aria-expanded={isOpen}
                      className="w-full px-4 py-3 text-left"
                    >
                      <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                        <span className="text-sm font-semibold text-ink">{e.term}</span>
                        {e.reading && (
                          <span className="font-mono text-[10px] text-ink-soft">{e.reading}</span>
                        )}
                        {e.aliases && e.aliases.length > 0 && (
                          <span className="text-[10px] text-ink-soft">
                            = {e.aliases.join(' / ')}
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-ink">
                        {e.plainTerm && (
                          <span className="text-ink-soft">{e.plainTerm}。</span>
                        )}
                        {renderInline(e.plain, `${e.id}-plain`)}
                      </span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-ink-soft">
                        {renderInline(e.short, `${e.id}-short`)}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="border-t border-border px-4 py-3">
                        <div className="space-y-2.5">
                          {e.long.map((p, i) => (
                            <p key={i} className="text-xs leading-relaxed text-ink">
                              {renderInline(p, `${e.id}-p${i}`)}
                            </p>
                          ))}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border pt-2.5 text-[11px]">
                          {e.related && e.related.length > 0 && (
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-soft">
                              <span className="text-[10px]">関連:</span>
                              {e.related.map((r) => (
                                <Term key={r} id={r} />
                              ))}
                            </span>
                          )}
                          {e.href && (
                            <a
                              href={e.href}
                              target="_blank"
                              rel="noreferrer"
                              className="text-ink-soft underline underline-offset-2 hover:text-accent"
                            >
                              一次資料
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
