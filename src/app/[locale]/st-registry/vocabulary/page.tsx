import { setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '@/samples/st-registry/nav';
import vocab from '@/samples/st-registry/data/vocabulary.json';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const TIER_STYLE: Record<string, string> = {
  core: 'border-emerald-600 text-emerald-800 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300',
  recommended: 'border-blue-700 text-blue-800 bg-blue-50 dark:bg-blue-950 dark:text-blue-300',
  extension: 'border-gray-400 text-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-400',
};

/** 値だけでは足りない、を示す小さな印 */
function Req({ label }: { label: string }) {
  return (
    <span className="font-mono text-[0.65rem] px-1.5 py-0.5 border border-amber-600 text-amber-800 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 rounded-sm whitespace-nowrap">
      {label}
    </span>
  );
}

export default async function Vocabulary({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('st-registry.Vocab');
  const ja = locale === 'ja';

  const byTier = (tier: string) => vocab.fields.filter((f) => f.tier === tier);

  return (
    <div className="container mx-auto px-4 py-10 flex flex-col gap-10 max-w-5xl">
      <header className="flex flex-col gap-3">
        <div className="font-mono text-xs tracking-widest uppercase text-blue-800 dark:text-blue-300">
          {t('kicker')} · v{vocab.version}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold leading-tight">{t('title')}</h1>
        <p className="max-w-2xl text-gray-600 dark:text-gray-300">{t('lead')}</p>
      </header>

      <section className="border-l-4 border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 max-w-3xl flex flex-col gap-2">
        <div className="font-bold text-sm">{t('howTitle')}</div>
        <p className="text-sm text-gray-700 dark:text-gray-300">{t('howBody')}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">{t('principleTitle')}</h2>
        <ol className="list-decimal pl-5 flex flex-col gap-1.5 text-sm text-gray-700 dark:text-gray-300 max-w-2xl">
          {['p1', 'p2', 'p3'].map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ol>
      </section>

      {(['core', 'recommended', 'extension'] as const).map((tier) => (
        <section key={tier} className="flex flex-col gap-3">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="text-xl font-bold">{t(`${tier}Title`)}</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">{t(`${tier}Rule`)}</span>
          </div>

          <div className="flex flex-col gap-2">
            {byTier(tier).map((f) => (
              <div
                key={f.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 flex flex-col gap-1.5"
              >
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-bold">{ja ? f.ja : f.en}</span>
                  <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{f.id}</span>
                  <span
                    className={`font-mono text-[0.65rem] px-1.5 py-0.5 border rounded-sm ${TIER_STYLE[f.tier]}`}
                  >
                    {f.observed}/7
                  </span>
                  {f.basisRequired && <Req label={t('needBasis')} />}
                  {f.asOfRequired && <Req label={t('needAsOf')} />}
                  {f.scopeRequired && <Req label={t('needScope')} />}
                  {f.subtypeRequired && <Req label={t('needSubtype')} />}
                  {f.granularityRequired && <Req label={t('needGranularity')} />}
                  {f.periodsRequired && <Req label={t('needPeriods')} />}
                </div>

                {f.basisOptions && (
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    <span className="text-gray-500 dark:text-gray-400">{t('basisOptions')}: </span>
                    <span className="font-mono">{f.basisOptions.join(' / ')}</span>
                  </div>
                )}
                {f.subtypes && (
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    <span className="text-gray-500 dark:text-gray-400">{t('subtypes')}: </span>
                    <span className="font-mono">{f.subtypes.join(' / ')}</span>
                  </div>
                )}
                {f.variants && (
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    <span className="text-gray-500 dark:text-gray-400">{t('variants')}: </span>
                    <span className="font-mono">{f.variants.join(' · ')}</span>
                  </div>
                )}
                {ja && f.note && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{f.note}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">{t('outTitle')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">{t('outLead')}</p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5 text-sm text-gray-600 dark:text-gray-300 max-w-2xl">
          {vocab.notCovered.map((n, i) => (
            <li key={i}>{ja ? n : n}</li>
          ))}
        </ul>
      </section>

      <section className="border-l-4 border-amber-600 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 max-w-3xl">
        <div className="font-bold text-sm">{t('statusTitle')}</div>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{t('statusBody')}</p>
      </section>
    </div>
  );
}
