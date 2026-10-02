import Link from 'next/link';

/** 全ページ共通のナビ。読む順に並べる (入門 → デモ → 解説 → 応用 → 国際比較)。 */
const PAGES = [
  { href: '/basics', label: 'はじめから', hint: '入門' },
  { href: '/easy', label: 'はじめての人へ', hint: '入門' },
  { href: '/', label: 'デモ', hint: '動かす' },
  { href: '/learn', label: 'ゆっくり読む', hint: '解説' },
  { href: '/apply', label: '何を、どの台帳で', hint: '応用' },
  { href: '/world', label: 'どの国が進んでいるのか', hint: '国際比較' },
  { href: '/glossary', label: 'わからないとき', hint: '用語集' },
];

export function SiteNav() {
  return (
    <nav className="border-b border-border bg-surface/80 backdrop-blur">
      <div className="scroll-x mx-auto max-w-5xl px-4 sm:px-6">
        <ul className="flex min-w-max items-center gap-1 py-2">
          {PAGES.map((p, i) => (
            <li key={p.href} className="flex items-center">
              {i > 0 && <span className="mx-1 text-ink-soft">·</span>}
              <Link
                href={p.href}
                className="rounded px-2 py-1 text-xs text-ink-soft hover:bg-surface-2 hover:text-ink"
              >
                <span className="font-mono text-[9px] uppercase tracking-widest opacity-60">
                  {p.hint}
                </span>
                <span className="ml-1.5">{p.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
