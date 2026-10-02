import { setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '@/samples/st-registry/nav';
import { PROPERTIES } from '@/samples/st-registry/lib/chain';
import { PropertyCard } from '@/samples/st-registry/components/PropertyCard';
import { ConfidentialPanel } from '@/samples/st-registry/components/ConfidentialPanel';
import { Link } from '@/samples/st-registry/nav';
import { CHAIN } from '@/samples/st-registry/lib/chain';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('st-registry.HomePage');
  const tp = await getTranslations('st-registry.Property');
  const tc = await getTranslations('st-registry.Confidential');
  const td = await getTranslations('st-registry.Disclaimer');

  const labels = {
    field: tp('field'), value: tp('value'), basis: tp('basis'),
    occupancy: tp('occupancy'), grossFloorArea: tp('grossFloorArea'),
    appraisalValue: tp('appraisalValue'), calc: tp('calc'), result: tp('result'),
    notRun: tp('notRun'), capacity: tp('capacity'), ltvNote: tp('ltvNote'),
    refused: tp('refused'), noBasis: tp('noBasis'), notRequired: tp('notRequired'),
  };
  const lang = locale === 'ja' ? 'ja' : 'en';

  return (
    <div className="container mx-auto px-4 py-10 flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="font-mono text-xs tracking-widest uppercase text-blue-800 dark:text-blue-300">
          不動産ST · DvP prototype
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold leading-tight">{t('title')}</h1>
        <p className="max-w-2xl text-gray-600 dark:text-gray-300">{t('lead')}</p>
        <p className="max-w-2xl text-sm text-gray-500 dark:text-gray-400">{t('why')}</p>
        <div className="font-mono text-xs text-gray-500 dark:text-gray-400">
          {CHAIN.name} · chain {CHAIN.id}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROPERTIES.map((p, i) => (
          <PropertyCard
            key={p.id}
            id={p.id}
            name={p.name[lang]}
            source={p.source[lang]}
            tone={i === 0 ? 'a' : 'b'}
            labels={labels}
          />
        ))}
      </div>

      <ConfidentialPanel
        labels={{
          title: tc('title'), lead: tc('lead'), run: tc('run'),
          loan: tc('loan'), verdict: tc('verdict'), note: tc('note'),
        }}
      />

      <Link
        href="/survey"
        className="border-l-4 border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 max-w-3xl block hover:brightness-95"
      >
        <div className="font-bold text-sm">{t('surveyLink')}</div>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{t('surveyLead')}</p>
      </Link>

      <aside className="border-l-4 border-amber-600 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 max-w-3xl">
        <div className="font-bold text-sm">{td('title')}</div>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{td('body')}</p>
      </aside>
    </div>
  );
}
