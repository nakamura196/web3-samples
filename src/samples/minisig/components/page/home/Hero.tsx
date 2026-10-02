import { FaArrowRight } from 'react-icons/fa';
import { Link } from '@/samples/minisig/nav';
import { getTranslations } from 'next-intl/server';
import { CHAIN_INFO } from '@/samples/minisig/constants/site';

export default async function Hero() {
  const t = await getTranslations('minisig.HomePage');
  const tCommon = await getTranslations('minisig.Common');

  return (
    <section className="border-b border-gray-200 bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:border-gray-700 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950">
      <div className="container mx-auto px-4 py-20 md:py-28">
        <div className="max-w-3xl">
          <p className="mb-4 inline-block rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-mono text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
            {CHAIN_INFO.name} · chain id {CHAIN_INFO.chainId}
          </p>
          <h1 className="mb-5 text-4xl font-bold text-gray-900 dark:text-gray-100 md:text-5xl">
            {tCommon('title')}
          </h1>
          <p className="mb-8 text-lg leading-relaxed text-gray-700 dark:text-gray-300 md:text-xl">
            {t('lead')}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/app"
              className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700 sm:w-auto"
            >
              {t('cta')}
              <FaArrowRight className="ml-2" aria-hidden="true" />
            </Link>
            <Link
              href="/api-docs"
              className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-800 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 sm:w-auto"
            >
              {t('secondary')}
            </Link>
          </div>
          <p className="mt-6 text-sm text-amber-700 dark:text-amber-400">{t('warning')}</p>
        </div>
      </div>
    </section>
  );
}
