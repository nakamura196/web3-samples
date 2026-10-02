'use client';

/**
 * 語彙をチェーンから読む。
 *
 * /vocabulary は JSON を表示しているだけだが、こちらは **実際にチェーンに
 * 載っている語彙** を読む。標準がデータであることの確認になる。
 */
import { useEffect, useState } from 'react';
import {
  publicClient, ADDR, REGISTRY_ABI, FIELD_LABEL, TIER_LABEL, fromBytes32,
} from '@/samples/st-registry/lib/chain';

type Row = { id: string; tier: number; needsBasis: boolean; needsAsOf: boolean;
             needsScope: boolean; needsSubtype: boolean };

export function OnChainVocabulary({ labels }: { labels: Record<string, string> }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    (async () => {
      const n = (await publicClient.readContract({
        address: ADDR.registry, abi: REGISTRY_ABI, functionName: 'fieldCount',
      })) as bigint;
      const out = await Promise.all(
        Array.from({ length: Number(n) }, async (_, i) => {
          const key = (await publicClient.readContract({
            address: ADDR.registry, abi: REGISTRY_ABI, functionName: 'fieldAt', args: [BigInt(i)],
          })) as `0x${string}`;
          const s = (await publicClient.readContract({
            address: ADDR.registry, abi: REGISTRY_ABI, functionName: 'spec', args: [key],
          })) as readonly [boolean, boolean, boolean, boolean, boolean, number];
          return { id: fromBytes32(key), needsBasis: s[1], needsAsOf: s[2],
                   needsScope: s[3], needsSubtype: s[4], tier: s[5] };
        }),
      );
      setRows(out);
    })().catch(() => setRows([]));
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-bold">{labels.title}</span>
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
          {rows ? `fieldCount() = ${rows.length}` : '…'}
        </span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">{labels.lead}</p>
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm bg-white dark:bg-gray-800">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400">
              <th className="text-left font-medium px-3 py-2">{labels.field}</th>
              <th className="text-left font-medium px-3 py-2">{labels.tier}</th>
              <th className="text-left font-medium px-3 py-2">{labels.requires}</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((r) => (
              <tr key={r.id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-3 py-2">
                  <span className="font-medium">{FIELD_LABEL[r.id]?.ja ?? r.id}</span>{' '}
                  <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{r.id}</span>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{TIER_LABEL[r.tier]?.ja ?? r.tier}</td>
                <td className="px-3 py-2 flex flex-wrap gap-1">
                  {r.needsBasis && <Chip>{labels.basis}</Chip>}
                  {r.needsAsOf && <Chip>{labels.asOf}</Chip>}
                  {r.needsScope && <Chip>{labels.scope}</Chip>}
                  {r.needsSubtype && <Chip>{labels.subtype}</Chip>}
                  {!r.needsBasis && !r.needsAsOf && !r.needsScope && !r.needsSubtype && (
                    <span className="text-gray-400 font-mono text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
            {rows?.length === 0 && (
              <tr><td className="px-3 py-3 text-gray-400" colSpan={3}>{labels.empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[0.65rem] px-1.5 py-0.5 border border-amber-600 text-amber-800 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 rounded-sm whitespace-nowrap">
      {children}
    </span>
  );
}
