'use client';

import type { Receipt } from '@/lib/scenario';
import { explorerTx } from '@/lib/ledger';
import { ExtLink, Mono, abbrev } from './ui';

/**
 * 米切手に書かれていた項目と、XRPL のトランザクションを並べる。
 * 300 年前の紙に載っていた情報が、現代の 1 行にもそのまま揃っている。
 */
const ROWS: Array<{ paper: string; field: string; get: (r: Receipt) => string }> = [
  {
    paper: '誰が預け、どの蔵屋敷が預かったか',
    field: 'Account / Destination',
    get: (r) => `${abbrev(r.account, 6)}${r.destination ? ` → ${abbrev(r.destination, 6)}` : ''}`,
  },
  {
    paper: '米の数量 (石)',
    field: 'DeliverMax',
    get: (r) => r.amount ?? '—',
  },
  {
    paper: '年号と月日',
    field: 'Ledger',
    get: (r) => `#${r.ledgerIndex.toLocaleString()}`,
  },
  {
    paper: '「相渡し申すべく候」— 引き換えの約束',
    field: 'Result',
    get: (r) => r.result,
  },
  {
    paper: '蔵元の印判',
    field: 'hash',
    get: (r) => abbrev(r.hash, 10),
  },
];

export function RiceNote({ receipt }: { receipt: Receipt }) {
  return (
    <div>
      <p className="mb-3 text-xs leading-relaxed text-ink-soft">{receipt.summary}</p>
      <div className="scroll-x">
        <table className="w-full min-w-[34rem] text-left text-xs">
          <thead className="text-ink-soft">
            <tr className="border-b border-border">
              <th className="w-1/2 py-1.5 font-medium">米切手 · 大坂 · 18 世紀</th>
              <th className="py-1.5 font-medium">XRPL のトランザクション</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.field} className="border-b border-border/50 align-top last:border-0">
                <td className="py-2 pr-4 leading-relaxed">{row.paper}</td>
                <td className="py-2">
                  <div className="text-[10px] uppercase tracking-wide text-ink-soft">
                    {row.field}
                  </div>
                  <Mono>{row.get(receipt)}</Mono>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs">
        <ExtLink href={explorerTx(receipt.hash)}>testnet.xrpl.org でこの切手を確認する →</ExtLink>
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
        違うのは、紙の切手は焼ければ権利ごと消えたのに対し、こちらは世界中の誰でも、
        蔵元の許可を得ずに、同じ 1 行を検証できることである。
      </p>
    </div>
  );
}
