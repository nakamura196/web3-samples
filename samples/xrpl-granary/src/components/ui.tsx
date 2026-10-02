import type { ReactNode } from 'react';

export function Card({
  title,
  hint,
  right,
  children,
}: {
  title?: string;
  hint?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      {(title || right) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-semibold tracking-wide">{title}</h2>}
            {hint && <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Mono({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-xs ${className}`}>{children}</span>;
}

/** 長い hex / アドレスを先頭と末尾だけ見せる */
export function abbrev(s: string, keep = 6): string {
  return s.length <= keep * 2 + 3 ? s : `${s.slice(0, keep)}…${s.slice(-keep)}`;
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'ok' | 'warn' | 'err' | 'accent';
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: 'border-border text-ink-soft',
    ok: 'border-ok/40 text-ok',
    warn: 'border-warn/40 text-warn',
    err: 'border-err/40 text-err',
    accent: 'border-accent/40 text-accent',
  };
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
    >
      {children}
    </a>
  );
}

/** 実際に走らせている xrpl.js のコードを見せる */
export function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="scroll-x mt-3 rounded border border-border bg-surface-2 p-3 font-mono text-[11px] leading-relaxed">
      <code>{code}</code>
    </pre>
  );
}
