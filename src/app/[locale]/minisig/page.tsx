import { routing } from '@/samples/minisig/nav';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import Hero from '@/samples/minisig/components/page/home/Hero';
import { ThresholdFigure } from '@/samples/minisig/components/figures';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('minisig.HomePage');

  const features = ['f1', 'f2', 'f3', 'f4'] as const;
  const steps = ['s1', 's2', 's3'] as const;

  return (
    <main>
      <Hero />

      {/* 図: 閾値 */}
      <section className="container mx-auto max-w-3xl px-4 pt-12">
        <ThresholdFigure />
      </section>

      {/* 特徴 */}
      <section className="container mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {features.map((k) => (
            <div
              key={k}
              className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800/50"
            >
              <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t(`features.${k}.title`)}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">{t(`features.${k}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 使い方 */}
      <section className="border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40">
        <div className="container mx-auto px-4 py-16">
          <h2 className="mb-8 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('howto.title')}
          </h2>
          <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {steps.map((k, i) => (
              <li key={k} className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800/50">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 font-bold text-white">
                  {i + 1}
                </div>
                <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                  {t(`howto.${k}.title`)}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">{t(`howto.${k}.desc`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}
