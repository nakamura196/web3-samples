'use client';

/**
 * 「コードを生成」— 実行時の本物の値を差し込んで組み立てたコードを、1 行ずつ出す。
 *
 * 原典のデモの Generate Code と同じ発想だが、差し込む値が違う。あちらが
 * 入れられるのはフォームに打った値だけで、こちらは ① で実際に作られた
 * 口座のアドレスを入れられる。自分の口座が書かれたコードが出てくるほうが、
 * 演習としては効く。
 *
 * 行単位で出すので、途中で構文が壊れて表示されることがない。
 */

import { useEffect, useState } from 'react';

export function GeneratedCode({
  code,
  animate = true,
  note = null,
}: {
  code: string;
  animate?: boolean;
  /**
   * コードの下に出す一行。ステップごとに事情が違うので呼び出し側が決める
   * (lib/codegen.ts の noteFor)。接続コードのように何も要らなければ null。
   */
  note?: string | null;
}) {
  const lines = code.split('\n');
  const [shown, setShown] = useState(animate ? 0 : lines.length);

  useEffect(() => {
    // 初期値の時点で出し切っているので、ここで戻す必要はない
    if (!animate) return;
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= lines.length) clearInterval(timer);
    }, 45);
    return () => clearInterval(timer);
    // code が変わったときは呼び出し側が key を変えて作り直す
  }, [animate, lines.length]);

  const done = shown >= lines.length;

  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">
          JavaScript · xrpl.js
        </span>
        {done && (
          <button
            onClick={() => navigator.clipboard?.writeText(code)}
            className="font-mono text-[10px] text-ink-soft underline underline-offset-2 hover:text-accent"
          >
            コピー
          </button>
        )}
      </div>

      <pre className="scroll-x rounded border border-border bg-surface-2 p-3 font-mono text-[11px] leading-relaxed">
        <code>
          {lines.slice(0, shown).map((l, i) => (
            <span key={i} className="block animate-fade-in">
              {l === '' ? ' ' : l}
            </span>
          ))}
          {!done && <span className="inline-block h-3 w-1.5 animate-pulse bg-accent align-middle" />}
        </code>
      </pre>

      {done && note && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">{note}</p>
      )}
    </div>
  );
}
