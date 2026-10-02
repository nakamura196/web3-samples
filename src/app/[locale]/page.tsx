import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { Link } from '@/i18n/routing';
import { SAMPLES } from '@/samples';
import { ToggleLanguage } from '@/components/ToggleLanguage';
import { ToggleTheme } from '@/components/ToggleTheme';

const REPO = 'https://github.com/nakamura196/web3-samples/tree/main';

export default function PortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations('Portal');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-3 sm:px-6 justify-between">
        <span className="text-base sm:text-xl font-bold">{t('title')}</span>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <ToggleTheme />
          <ToggleLanguage />
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 md:py-16">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">{t('title')}</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-10 max-w-3xl">{t('description')}</p>

        <ul className="grid gap-6 md:grid-cols-2">
          {SAMPLES.map(({ slug }) => (
            <li
              key={slug}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 flex flex-col"
            >
              <h2 className="text-xl font-semibold mb-2">{t(`samples.${slug}.title`)}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 flex-1">
                {t(`samples.${slug}.description`)}
              </p>
              <div className="flex items-center gap-4 text-sm">
                <Link
                  href={`/${slug}`}
                  className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
                >
                  {t('open')}
                </Link>
                <a
                  href={`${REPO}/src/app/%5Blocale%5D/${slug}`}
                  className="text-gray-600 dark:text-gray-300 hover:underline"
                >
                  {t('source')}
                </a>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
