import { setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '@/samples/st-registry/nav';
import survey from '@/samples/st-registry/data/survey.json';
import layers from '@/samples/st-registry/data/layers.json';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** 数字の帯。内部一致と外部一致の差を、目で見て分かる長さで示す。 */
function Bar({ v, tone }: { v: number; tone: 'in' | 'out' }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono tabular-nums w-10">{v.toFixed(2)}</span>
      <span className="inline-block h-2 w-24 bg-gray-200 dark:bg-gray-700 rounded-sm overflow-hidden">
        <span
          className={`block h-full ${tone === 'in' ? 'bg-emerald-600' : 'bg-gray-400 dark:bg-gray-500'}`}
          style={{ width: `${Math.round(v * 100)}%` }}
        />
      </span>
    </span>
  );
}

export default async function Survey({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('st-registry.Survey');
  const p = survey.population;

  return (
    <div className="container mx-auto px-4 py-10 flex flex-col gap-10 max-w-5xl">
      <header className="flex flex-col gap-3">
        <div className="font-mono text-xs tracking-widest uppercase text-blue-800 dark:text-blue-300">
          {t('kicker')}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold leading-tight">{t('title')}</h1>
        <p className="max-w-2xl text-gray-600 dark:text-gray-300">{t('lead')}</p>
        <div className="font-mono text-xs text-gray-500 dark:text-gray-400">
          EDINET · {survey.asOf}
        </div>
      </header>

      {/* 母集団 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">{t('populationTitle')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">{t('populationLead')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { n: p.filings, k: t('pFilings') },
            { n: p.estate, k: t('pEstate'), hi: true },
            { n: p.notes, k: t('pNotes') },
            { n: p.extracted, k: t('pExtracted') },
          ].map((c) => (
            <div
              key={c.k}
              className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-t-4 px-3 py-3 ${
                c.hi ? 'border-t-blue-800' : 'border-t-gray-300 dark:border-t-gray-600'
              }`}
            >
              <div className="font-mono text-2xl font-semibold tabular-nums">{c.n}</div>
              <div className="text-xs text-gray-600 dark:text-gray-300 leading-snug">{c.k}</div>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">{t('populationNote')}</p>
      </section>

      {/* 二層 */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">{t('layerTitle')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">{t('layerLead')}</p>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-t-4 border-t-red-600 p-4 flex flex-col gap-2 max-w-3xl">
          <div className="text-sm text-gray-600 dark:text-gray-300">{t('qualLead')}</div>
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex flex-col">
              <span className="font-mono text-2xl font-semibold tabular-nums">
                {layers.qualifiers.layer1.count}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{t('qL1')}</span>
            </div>
            <span className="text-2xl text-gray-400 pb-1">→</span>
            <div className="flex flex-col">
              <span className="font-mono text-2xl font-semibold tabular-nums text-red-700 dark:text-red-400">
                {layers.qualifiers.layer2.count}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{t('qL2')}</span>
            </div>
            <div className="flex flex-col ml-auto">
              <span className="font-mono text-2xl font-semibold tabular-nums text-red-700 dark:text-red-400">
                {(layers.qualifiers.inheritance * 100).toFixed(1)}%
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{t('qRate')}</span>
            </div>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">{t('qualNote')}</p>
        </div>

        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm bg-white dark:bg-gray-800">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400">
                <th className="text-left font-medium px-3 py-2">{t('amName')}</th>
                <th className="text-right font-medium px-3 py-2">{t('l1')}</th>
                <th className="text-right font-medium px-3 py-2">{t('l2')}</th>
                <th className="text-right font-medium px-3 py-2">{t('keep')}</th>
              </tr>
            </thead>
            <tbody>
              {layers.byAm.map((r) => {
                const keep = r.l1f && r.l2f !== null ? r.l2f / r.l1f : null;
                return (
                  <tr key={r.am} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-3 py-2 font-medium">{r.am}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {r.l1f ?? '—'} <span className="text-gray-400 text-xs">({r.l1n})</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {r.l2f ?? '—'} <span className="text-gray-400 text-xs">({r.l2n})</span>
                    </td>
                    <td className={`px-3 py-2 text-right font-mono tabular-nums font-semibold ${
                      keep === null ? 'text-gray-400'
                        : keep === 0 ? 'text-red-700 dark:text-red-400'
                        : 'text-amber-700 dark:text-amber-400'}`}>
                      {keep === null ? '—' : `${(keep * 100).toFixed(0)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">{t('layerNote')}</p>
      </section>

      {/* 本題 */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">{t('whoTitle')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">{t('whoLead')}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(
            [
              ['am', survey.byAm, t('byAm')],
              ['trustee', survey.byTrustee, t('byTrustee')],
            ] as const
          ).map(([key, s, label]) => {
            const diff = s.innerAvg - s.crossAvg;
            const decisive = diff > 0.2;
            return (
              <div
                key={key}
                className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-t-4 p-4 flex flex-col gap-3 ${
                  decisive ? 'border-t-emerald-600' : 'border-t-gray-400'
                }`}
              >
                <div className="font-bold">{label}</div>
                <dl className="text-sm flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-gray-600 dark:text-gray-300">{t('inner')}</dt>
                    <dd>
                      <Bar v={s.innerAvg} tone="in" />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-gray-600 dark:text-gray-300">{t('cross')}</dt>
                    <dd>
                      <Bar v={s.crossAvg} tone="out" />
                    </dd>
                  </div>
                </dl>
                <div
                  className={`font-mono text-sm font-semibold ${
                    decisive
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {t('diff')} {diff > 0 ? '+' : ''}
                  {diff.toFixed(2)} {decisive ? `— ${t('decisive')}` : `— ${t('notDecisive')}`}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-l-4 border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 max-w-3xl">
          <div className="font-bold text-sm">{t('verdictTitle')}</div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{t('verdictBody')}</p>
        </div>
      </section>

      {/* AM 別の内訳 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">{t('amTitle')}</h2>
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm bg-white dark:bg-gray-800">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400">
                <th className="text-left font-medium px-3 py-2">{t('amName')}</th>
                <th className="text-right font-medium px-3 py-2">{t('count')}</th>
                <th className="text-left font-medium px-3 py-2">{t('inner')}</th>
                <th className="text-right font-medium px-3 py-2">{t('common')}</th>
              </tr>
            </thead>
            <tbody>
              {survey.byAm.groups.map((g) => (
                <tr key={g.name} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-3 py-2 font-medium">{g.name}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{g.n}</td>
                  <td className="px-3 py-2">
                    <Bar v={g.inner} tone="in" />
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{g.common}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">{t('amNote')}</p>
      </section>

      {/* 検証 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">{t('verifiedTitle')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">{t('verifiedLead')}</p>
        <div className="border-l-4 border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 max-w-3xl flex flex-col gap-2">
          <div className="font-bold text-sm">{t('verifiedResult')}</div>
          <ul className="text-sm text-gray-700 dark:text-gray-300 list-disc pl-5 flex flex-col gap-1">
            {survey.verified.corrected.map((c) => (
              <li key={c.docID}>
                <span className="font-mono text-xs">{c.docID}</span> — 「{c.was}」→「{c.now}」（{c.reason}）
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 項目 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">{t('fieldsTitle')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">{t('fieldsLead')}</p>
        <div className="flex flex-wrap gap-1.5">
          {survey.topFields.map((f) => {
            const share = f.n / p.extracted;
            return (
              <span
                key={f.label}
                className={`font-mono text-xs px-2 py-1 border rounded-sm ${
                  share > 0.9
                    ? 'border-emerald-600 text-emerald-800 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300'
                    : share > 0.6
                      ? 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                      : 'border-amber-500 text-amber-800 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300'
                }`}
              >
                {f.label} <span className="opacity-60">{f.n}</span>
              </span>
            );
          })}
        </div>
        <div className="border-l-4 border-amber-600 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 max-w-3xl">
          <div className="font-bold text-sm">{t('universalTitle')}</div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
            {t('universalBody')}{' '}
            <span className="font-mono">{survey.universal.join(' / ')}</span>
          </p>
        </div>
      </section>

      {/* データ */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">{t('dataTitle')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">{t('dataLead')}</p>
        <div className="flex flex-col gap-2">
          {[
            { href: '/assets/st-registry/data/st-fields-2026-08.json', name: 'st-fields-2026-08.json', desc: t('dJson') },
            { href: '/assets/st-registry/data/st-fields-matrix-2026-08.csv', name: 'st-fields-matrix-2026-08.csv', desc: t('dCsv') },
            { href: '/assets/st-registry/data/st-layer2-2026-08.json', name: 'st-layer2-2026-08.json', desc: t('dL2') },
          ].map((f) => (
            <a
              key={f.href}
              href={f.href}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 hover:border-blue-700 flex flex-col gap-0.5"
            >
              <span className="font-mono text-sm text-blue-800 dark:text-blue-300 underline">{f.name}</span>
              <span className="text-sm text-gray-600 dark:text-gray-300">{f.desc}</span>
            </a>
          ))}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">{t('dataNote')}</p>
      </section>

      {/* 頑健性 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">{t('robustTitle')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">{t('robustLead')}</p>
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm bg-white dark:bg-gray-800">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400">
                <th className="text-left font-medium px-3 py-2">{t('grouping')}</th>
                <th className="text-right font-medium px-3 py-2">{t('raw')}</th>
                <th className="text-right font-medium px-3 py-2">{t('normd')}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-3 py-2 font-medium">{t('byAm')}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-semibold">
                  +{survey.normalized.am_raw.diff.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-semibold">
                  +{survey.normalized.am_norm.diff.toFixed(2)}
                </td>
              </tr>
              <tr className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-3 py-2 font-medium">{t('byTrustee')}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-500">
                  +{survey.normalized.filer_raw.diff.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-gray-500">
                  +{survey.normalized.filer_norm.diff.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="border-l-4 border-amber-600 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 max-w-3xl">
          <div className="font-bold text-sm">{t('normTitle')}</div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{t('normBody')}</p>
        </div>
        <div className="border-l-4 border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 max-w-3xl">
          <div className="font-bold text-sm">{t('valTitle')}</div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{t('valBody')}</p>
        </div>
      </section>

      {/* 限界 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">{t('limitsTitle')}</h2>
        <ul className="list-disc pl-5 text-sm text-gray-600 dark:text-gray-300 flex flex-col gap-1.5 max-w-2xl">
          {['l1', 'l2', 'l3', 'l4'].map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
