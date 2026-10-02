'use client';

/**
 * 非開示のまま判定する。
 *
 * 目論見書には、こう書かれた項目がある。
 *   「賃料及び共益費 ── 非開示（固定賃料＋変動賃料型）」
 *   「賃借人から開示の同意が得られていないため」
 *
 * 賃料は出せない。しかし担保評価には賃料が要る。
 * 秘匿 EVM(Oasis Sapphire)なら、賃料をチェーンに置いたまま
 * 「基準を満たすか」だけを返せる。ふつうの EVM ではストレージが
 * 読めてしまうので、同じコードでも目的を果たさない。
 */
import { useState } from 'react';
import { publicClient, ADDR, RENT_ABI, toBytes32, EXPLORER } from '@/samples/st-registry/lib/chain';

const YEN = new Intl.NumberFormat('ja-JP');
const CASES = [300_000_000, 600_000_000, 900_000_000];

export function ConfidentialPanel({ labels }: { labels: Record<string, string> }) {
  const [rows, setRows] = useState<{ loan: number; ok: boolean }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const out = await Promise.all(
        CASES.map(async (loan) => {
          const ok = (await publicClient.readContract({
            address: ADDR.rent,
            abi: RENT_ABI,
            functionName: 'meetsCoverage',
            args: [toBytes32('PROP_A'), BigInt(loan), BigInt(10_000)],
          })) as boolean;
          return { loan, ok };
        }),
      );
      setRows(out);
    } catch (e) {
      setErr(e instanceof Error ? e.message.slice(0, 140) : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-t-4 border-t-blue-800 p-4 flex flex-col gap-3">
      <div>
        <div className="font-mono text-xs tracking-widest uppercase text-blue-800 dark:text-blue-300">
          confidential
        </div>
        <div className="font-bold">{labels.title}</div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 max-w-2xl">{labels.lead}</p>
      </div>

      <button
        onClick={run}
        disabled={busy}
        className="self-start bg-blue-800 hover:brightness-110 disabled:opacity-50 text-white font-semibold text-sm rounded px-3 py-1.5"
      >
        {labels.run}
      </button>

      {err && (
        <div className="font-mono text-xs px-3 py-2 border-l-4 border-red-600 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300">
          {err}
        </div>
      )}

      {rows.length > 0 && (
        <table className="text-sm w-full max-w-lg">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400">
              <th className="text-left font-medium px-3 py-1.5">{labels.loan}</th>
              <th className="text-left font-medium px-3 py-1.5">{labels.verdict}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.loan} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-3 py-1.5 font-mono tabular-nums">¥{YEN.format(r.loan)}</td>
                <td
                  className={`px-3 py-1.5 font-mono font-semibold ${
                    r.ok
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}
                >
                  {r.ok ? 'true' : 'false'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">{labels.note}</p>

      {EXPLORER && (
        <a
          href={`${EXPLORER}/address/${ADDR.rent}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-blue-800 dark:text-blue-300 underline self-start"
        >
          {ADDR.rent}
        </a>
      )}
    </div>
  );
}
