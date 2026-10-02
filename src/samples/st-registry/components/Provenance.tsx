'use client';

/**
 * 記録の来歴。
 *
 * 誰がいつ何を記録したかを、チェーンのイベントから組み立てる。索引サーバは使わない。
 *
 * ただし Sapphire は **履歴の照会を 100 ブロックまでに制限している**
 * (max allowed of rounds in logs query is: 100)。
 * 秘匿チェーンでは過去を自由に走査できない。隠すほど後から確かめにくくなる、
 * というトレードオフがそのまま出ている場所。
 */
import { useCallback, useEffect, useState } from 'react';
import { publicClient, ADDR, REGISTRY_ABI, EXPLORER, FIELD_LABEL, BASIS_LABEL, fromBytes32, toBytes32 } from '@/samples/st-registry/lib/chain';

type Ev = { block: bigint; tx: string; property: string; field: string;
            value: bigint; basis: string; by?: string; version?: number };

export function Provenance({ labels }: { labels: Record<string, string> }) {
  const [rows, setRows] = useState<Ev[] | null>(null);
  const [range, setRange] = useState<string>('');

  const load = useCallback(async () => {
    setRows(null);
    try {
      const latest = await publicClient.getBlockNumber();
      // Sapphire の上限は 100 ブロック。超えると RPC がエラーを返す。
      const from = latest > 99n ? latest - 99n : 0n;
      setRange(`${from} – ${latest}`);
      const logs = await publicClient.getContractEvents({
        address: ADDR.registry, abi: REGISTRY_ABI, eventName: 'Recorded',
        fromBlock: from, toBlock: latest,
      });
      const base = logs.slice(-25).reverse().map((l) => ({
          block: l.blockNumber ?? 0n,
          tx: l.transactionHash ?? '',
          property: fromBytes32(String(l.args.propertyId)),
          field: fromBytes32(String(l.args.field)),
          value: (l.args.value as bigint) ?? 0n,
          basis: fromBytes32(String(l.args.basis ?? '')),
      }));
      // 現在の値から「誰が申告したか」と「どの版で検証されたか」を引く
      const withWho = await Promise.all(base.map(async (r) => {
        try {
          const m = (await publicClient.readContract({
            address: ADDR.registry, abi: REGISTRY_ABI, functionName: 'get',
            args: [toBytes32(r.property), toBytes32(r.field)],
          })) as { attestedBy: string; vocabVersion: number };
          return { ...r, by: m.attestedBy, version: Number(m.vocabVersion) };
        } catch { return r; }
      }));
      setRows(withWho);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="font-bold">{labels.title}</span>
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
          {labels.blocks} {range}
        </span>
        <button
          onClick={load}
          className="text-xs text-blue-800 dark:text-blue-300 underline"
        >
          {labels.reload}
        </button>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">{labels.lead}</p>
      <p className="text-xs text-amber-800 dark:text-amber-300 max-w-2xl border-l-4 border-amber-600 bg-amber-50 dark:bg-amber-950/40 px-3 py-2">
        {labels.limit}
      </p>
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm bg-white dark:bg-gray-800">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400">
              <th className="text-left font-medium px-3 py-2">{labels.block}</th>
              <th className="text-left font-medium px-3 py-2">{labels.property}</th>
              <th className="text-left font-medium px-3 py-2">{labels.field}</th>
              <th className="text-right font-medium px-3 py-2">{labels.value}</th>
              <th className="text-left font-medium px-3 py-2">{labels.basis}</th>
              <th className="text-left font-medium px-3 py-2">{labels.by}</th>
              <th className="text-right font-medium px-3 py-2">{labels.ver}</th>
            </tr>
          </thead>
          <tbody>
            {rows === null && <tr><td className="px-3 py-3 text-gray-400" colSpan={7}>…</td></tr>}
            {rows?.map((r, i) => (
              <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-3 py-2 font-mono text-xs">
                  {EXPLORER && r.tx ? (
                    <a className="underline" href={`${EXPLORER}/tx/${r.tx}`} target="_blank" rel="noreferrer">
                      {String(r.block)}
                    </a>
                  ) : String(r.block)}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.property}</td>
                <td className="px-3 py-2">{FIELD_LABEL[r.field]?.ja ?? r.field}</td>
                <td className="px-3 py-2 font-mono text-xs text-right tabular-nums">{String(r.value)}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {r.basis ? (BASIS_LABEL[r.basis]?.ja ?? r.basis) : '—'}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {r.by ? `${r.by.slice(0, 6)}…${r.by.slice(-4)}` : '—'}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-right">
                  {r.version ? `v${r.version}` : '—'}
                </td>
              </tr>
            ))}
            {rows?.length === 0 && (
              <tr><td className="px-3 py-3 text-gray-400" colSpan={7}>{labels.empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
