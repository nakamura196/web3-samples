'use client';

/**
 * 用語のポップオーバー。
 *
 * <Term id="iou">IOU</Term> と明示して囲むこともできるし、
 * <AutoTerms> で地の文を渡して自動で拾わせることもできる。
 * 既存の説明文に手を入れずに用語解説を足せるよう、後者を主に使う。
 */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BY_ID, MATCHERS } from '@/lib/glossary';

/** `等幅` と **強調** を解釈する。用語集の本文はこの記法で書かれている */
export function renderInline(text: string, keyPrefix = 'i'): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
      return (
        <code
          key={key}
          className="rounded bg-surface-2 px-1 py-px font-mono text-[0.92em] text-ink"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 3) {
      return (
        <strong key={key} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={key}>{part}</span>;
  });
}

// ── ポップオーバー ──────────────────────────────────────────────

export function Term({ id, children }: { id: string; children?: ReactNode }) {
  const entry = BY_ID[id];
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setExpanded(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  // 用語集に無い id を渡された場合は、ただの文字として出す
  if (!entry) return <>{children ?? id}</>;

  const label = children ?? entry.term;

  return (
    <span ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        title={`${entry.term} — ${entry.short}`}
        className={`cursor-help border-b border-dotted border-accent/60 text-left hover:border-accent hover:text-accent ${
          open ? 'text-accent' : ''
        }`}
      >
        {label}
      </button>

      {open && (
        <span
          role="dialog"
          className="absolute left-0 top-[calc(100%+6px)] z-50 block w-[min(24rem,calc(100vw-2.5rem))] rounded-lg border border-border bg-surface p-3.5 text-left shadow-lg shadow-black/10"
        >
          <span className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold text-ink">{entry.term}</span>
            {entry.reading && (
              <span className="font-mono text-[10px] text-ink-soft">{entry.reading}</span>
            )}
          </span>

          <span className="block text-[11px] leading-relaxed text-ink">
            {renderInline(entry.plain, `${entry.id}-p`)}
          </span>
          <span className="mt-1.5 block text-[11px] leading-relaxed text-ink-soft">
            {renderInline(entry.short, `${entry.id}-s`)}
          </span>

          {expanded && (
            <span className="mt-2 block space-y-2 border-t border-border pt-2">
              {entry.long.map((p, i) => (
                <span key={i} className="block text-[11px] leading-relaxed text-ink-soft">
                  {renderInline(p, `${entry.id}-l${i}`)}
                </span>
              ))}
            </span>
          )}

          <span className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2 text-[10px]">
            {!expanded && entry.long.length > 0 && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="text-accent underline underline-offset-2"
              >
                もっと詳しく
              </button>
            )}
            <Link
              href={`/glossary#${entry.id}`}
              className="text-ink-soft underline underline-offset-2 hover:text-accent"
            >
              用語集で見る
            </Link>
            {entry.href && (
              <a
                href={entry.href}
                target="_blank"
                rel="noreferrer"
                className="text-ink-soft underline underline-offset-2 hover:text-accent"
              >
                一次資料
              </a>
            )}
          </span>
        </span>
      )}
    </span>
  );
}

// ── 自動リンク ──────────────────────────────────────────────────

interface Claim {
  start: number;
  end: number;
  id: string;
}

/** ASCII の語は前後が英数字でないことを確かめる。dropsToXrp の中の drops を拾わないため */
function isWordBoundary(hay: string, start: number, end: number, needle: string): boolean {
  if (!/^[\x20-\x7e]+$/.test(needle)) return true; // 日本語などはそのまま通す
  const before = start > 0 ? hay[start - 1] : ' ';
  const after = end < hay.length ? hay[end] : ' ';
  return !/[A-Za-z0-9_]/.test(before) && !/[A-Za-z0-9_]/.test(after);
}

/**
 * 地の文から既知の用語を拾ってリンクにする。
 *
 * ・長い表記から順に照合する (「トラストライン」を「トラスト」より先に取る)
 * ・1 つの用語につき最初の 1 箇所だけ。同じ段落が下線だらけになるのを避ける
 * ・すでに他の用語が取った範囲には重ねない
 */
export function AutoTerms({
  children,
  skip = [],
}: {
  children: string;
  skip?: string[];
}) {
  const text = children;
  const hay = text.toLowerCase();
  const claims: Claim[] = [];
  const used = new Set<string>(skip);

  for (const m of MATCHERS) {
    if (used.has(m.id)) continue;
    const needle = m.text.toLowerCase();
    let from = 0;
    for (;;) {
      const at = hay.indexOf(needle, from);
      if (at < 0) break;
      const end = at + needle.length;
      const overlaps = claims.some((c) => at < c.end && end > c.start);
      if (!overlaps && isWordBoundary(text, at, end, m.text)) {
        claims.push({ start: at, end, id: m.id });
        used.add(m.id);
        break;
      }
      from = at + 1;
    }
  }

  if (claims.length === 0) return <>{renderInline(text)}</>;

  claims.sort((a, b) => a.start - b.start);
  const out: ReactNode[] = [];
  let cursor = 0;
  claims.forEach((c, i) => {
    if (c.start > cursor) out.push(...renderInline(text.slice(cursor, c.start), `t${i}`));
    out.push(
      <Term key={`term-${i}-${c.id}`} id={c.id}>
        {text.slice(c.start, c.end)}
      </Term>,
    );
    cursor = c.end;
  });
  if (cursor < text.length) out.push(...renderInline(text.slice(cursor), 'tail'));
  return <>{out}</>;
}

// ── 本文に出す定義 ──────────────────────────────────────────────

/**
 * そのステップの主役になる語を、本文の直後に定義ごと置く。
 *
 * ポップオーバーは「たまたま出てきた語」には向くが、その節の主題には向かない。
 * 講義では誰もクリックしないし、投影すればホバーもクリックも働かない。
 * 主題の定義は読み流すだけで目に入る場所に要る。
 *
 * ここはやさしい方 (plainTerm / plain) を出す。常に見えている場所なので、
 * 前提知識を要求しないほうがよい。厳密な言い方はクリックした先 (Term) にある。
 * 「信用線」のように、語そのものが壁になっているものは見出しごと置き換え、
 * 本当の用語は括弧で残す — 消すと xrpl.org を読むときに困る。
 *
 * 文言は用語集をそのまま引くので、書き分けが二重管理にならない。
 */
export function KeyTerms({ ids }: { ids: string[] }) {
  const entries = ids.map((id) => BY_ID[id]).filter(Boolean);
  if (entries.length === 0) return null;

  return (
    <dl className="mt-3 space-y-1.5 rounded border border-border bg-surface-2 px-3 py-2.5">
      {entries.map((e) => (
        <div key={e.id} className="text-[11px] leading-relaxed">
          <dt className="inline font-semibold text-accent">{e.plainTerm ?? e.term}</dt>
          <dd className="inline text-ink-soft">
            {' — '}
            {renderInline(e.plain, `${e.id}-key`)}{' '}
            <Link
              href={`/glossary#${e.id}`}
              className="whitespace-nowrap text-ink-soft underline underline-offset-2 hover:text-accent"
            >
              詳しく
            </Link>
          </dd>
        </div>
      ))}
    </dl>
  );
}
