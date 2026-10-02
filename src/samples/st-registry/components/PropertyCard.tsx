'use client';

/**
 * 銘柄カード。記述レジストリを読んで並べ、担保余力をコントラクトに問い合わせる。
 *
 * 見せたいのは 1 点だけ。**同じ稼働率 100% でも、分母が宣言されていなければ
 * コントラクトは評価を実行できない。** 拒否は不具合ではなく、正しい振る舞いである。
 */
import { useEffect, useState } from 'react';
import { ContractFunctionRevertedError, BaseError } from 'viem';
import {
  publicClient,
  ADDR,
  REGISTRY_ABI,
  VAULT_ABI,
  FIELD,
  BASIS_LABEL,
  USABLE_OCCUPANCY_BASIS,
  fromBytes32,
  toBytes32,
} from '@/samples/st-registry/lib/chain';

type Measure = { value: bigint; basis: string; asOf: number };
type Row = { key: string; label: string; measure: Measure | null };

const YEN = new Intl.NumberFormat('ja-JP');

/** 語彙で根拠が必須と宣言されている項目。要らない項目に札を出すと紛らわしい。 */
function needsBasis(key: string) {
  return (
    key === FIELD.OCCUPANCY ||
    key === FIELD.UNDECLARED_OCC ||
    key === FIELD.GROSS_FLOOR_AREA ||
    key === FIELD.LAND_AREA
  );
}

function fmt(key: string, v: bigint) {
  if (key === FIELD.OCCUPANCY || key === FIELD.UNDECLARED_OCC)
    return (Number(v) / 100).toFixed(1) + '%';
  if (key === FIELD.GROSS_FLOOR_AREA) return YEN.format(Number(v) / 100) + '㎡';
  return '¥' + YEN.format(Number(v));
}

export function PropertyCard({
  id,
  name,
  source,
  tone,
  labels,
}: {
  id: string;
  name: string;
  source: string;
  tone: 'a' | 'b';
  labels: Record<string, string>;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fields: [string, string][] = [
      [id === 'PROP_B' ? FIELD.UNDECLARED_OCC : FIELD.OCCUPANCY, labels.occupancy],
      [FIELD.GROSS_FLOOR_AREA, labels.grossFloorArea],
      [FIELD.APPRAISAL_VALUE, labels.appraisalValue],
    ];
    Promise.all(
      fields.map(async ([key, label]): Promise<Row> => {
        try {
          const m = (await publicClient.readContract({
            address: ADDR.registry,
            abi: REGISTRY_ABI,
            functionName: 'get',
            args: [toBytes32(id), toBytes32(key)],
          })) as { value: bigint; basis: string; asOf: bigint };
          return {
            key,
            label,
            measure: { value: m.value, basis: fromBytes32(m.basis), asOf: Number(m.asOf) },
          };
        } catch {
          return { key, label, measure: null }; // 未登録
        }
      }),
    ).then(setRows);
  }, [id, labels.occupancy, labels.grossFloorArea, labels.appraisalValue]);

  async function calc() {
    setBusy(true);
    setResult(null);
    try {
      const cap = (await publicClient.readContract({
        address: ADDR.vault,
        abi: VAULT_ABI,
        functionName: 'borrowingPower',
        args: [toBytes32(id)],
      })) as bigint;
      setResult({ ok: true, text: `${labels.capacity} ¥${YEN.format(Number(cap))}（${labels.ltvNote}）` });
    } catch (err) {
      let text = labels.refused;
      if (err instanceof BaseError) {
        const rev = err.walk((e) => e instanceof ContractFunctionRevertedError);
        if (rev instanceof ContractFunctionRevertedError) {
          const nm = rev.data?.errorName ?? '';
          const arg = rev.data?.args?.[0];
          const shown = typeof arg === 'string' && arg.startsWith('0x') ? fromBytes32(arg) : String(arg ?? '');
          text = `revert ${nm}(${shown})`;
        }
      }
      setResult({ ok: false, text });
    } finally {
      setBusy(false);
    }
  }

  const accent = tone === 'a' ? 'border-t-emerald-600' : 'border-t-red-600';
  const who = tone === 'a' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400';

  return (
    <div
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-t-4 ${accent} flex flex-col`}
    >
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className={`font-mono text-xs tracking-widest uppercase ${who}`}>{id}</div>
        <div className="font-bold">{name}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{source}</div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400">
            <th className="text-left font-medium px-4 py-2">{labels.field}</th>
            <th className="text-left font-medium px-4 py-2">{labels.value}</th>
            <th className="text-left font-medium px-4 py-2">{labels.basis}</th>
          </tr>
        </thead>
        <tbody>
          {rows === null && (
            <tr>
              <td className="px-4 py-3 text-gray-400" colSpan={3}>
                …
              </td>
            </tr>
          )}
          {rows?.filter((r) => r.measure).map((r) => {
            const m = r.measure!;
            const good =
              r.key === FIELD.OCCUPANCY || r.key === FIELD.UNDECLARED_OCC
                ? USABLE_OCCUPANCY_BASIS.includes(m.basis)
                : m.basis !== '' && m.basis !== 'UNDECLARED';
            return (
              <tr key={r.key} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-4 py-2 font-mono text-xs text-gray-600 dark:text-gray-300">
                  {r.label}
                </td>
                <td className="px-4 py-2 font-mono tabular-nums">{fmt(r.key, m.value)}</td>
                <td className="px-4 py-2">
                  {needsBasis(r.key) ? (
                    <span
                      className={`font-mono text-xs px-1.5 py-0.5 rounded border ${
                        good
                          ? 'text-emerald-700 border-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400'
                          : 'text-red-700 border-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400'
                      }`}
                    >
                      {BASIS_LABEL[m.basis]?.ja ?? (m.basis || labels.noBasis)}
                    </span>
                  ) : (
                    <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                      {labels.notRequired}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="px-4 py-3 mt-auto flex flex-col gap-2">
        <button
          onClick={calc}
          disabled={busy}
          className="self-start bg-blue-800 hover:brightness-110 disabled:opacity-50 text-white font-semibold text-sm rounded px-3 py-1.5"
        >
          {labels.calc}
        </button>
        <div
          className={`font-mono text-xs px-3 py-2 border-l-4 ${
            result === null
              ? 'border-gray-300 bg-gray-50 dark:bg-gray-900 dark:border-gray-600 text-gray-500'
              : result.ok
                ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'border-red-600 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300'
          }`}
        >
          <div className="uppercase tracking-wider opacity-70 mb-0.5">{labels.result}</div>
          {result?.text ?? labels.notRun}
        </div>
      </div>
    </div>
  );
}
