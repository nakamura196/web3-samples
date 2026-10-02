'use client';

import type { BookRow } from '@/lib/ledger';

import { Mono, abbrev } from './ui';

export function OrderBook({ rows }: { rows: BookRow[] | null }) {
  if (rows === null) {
    return <p className="text-xs text-ink-soft">発行体がまだ存在しないため、板はない。</p>;
  }
  if (rows.length === 0) {
    return (
      <p className="text-xs text-ink-soft">
        板は空。注文が出ていないか、すでに約定して消えたかのどちらか。
      </p>
    );
  }
  return (
    <div className="scroll-x">
      <table className="w-full min-w-[26rem] text-left text-xs">
        <thead className="text-ink-soft">
          <tr className="border-b border-border">
            <th className="py-1.5 font-medium">売り手</th>
            <th className="py-1.5 font-medium">売る量 (石)</th>
            <th className="py-1.5 font-medium">対価</th>
            <th className="py-1.5 text-right font-medium">単価</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.account}-${i}`} className="border-b border-border/50 last:border-0">
              <td className="py-1.5">
                <Mono>{abbrev(r.account, 5)}</Mono>
              </td>
              <td className="py-1.5 font-mono">
                {r.getsValue} 石
              </td>
              <td className="py-1.5 font-mono">{r.paysXrp} XRP</td>
              <td className="py-1.5 text-right font-mono">{r.price} XRP</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
