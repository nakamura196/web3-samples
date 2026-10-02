import { FaArrowRight } from 'react-icons/fa';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/samples/tictactoe/nav';

export default async function Hero() {
  const t = await getTranslations('tictactoe.HomePage');
  const tCommon = await getTranslations('tictactoe.Common');
  const tFooter = await getTranslations('tictactoe.Footer');

  const points = ['escrow', 'judge', 'timeout'] as const;

  return (
    <>
      <section className="bg-gray-900 dark:bg-black">
        <div className="container mx-auto px-4 py-24 md:py-32">
          <div className="max-w-3xl">
            <p className="mb-4 inline-block rounded-full bg-amber-400/20 px-3 py-1 text-sm text-amber-300">
              {tFooter('testnetNotice')}
            </p>
            <h1 className="mb-6 text-4xl font-bold text-white md:text-5xl">{tCommon('title')}</h1>
            <p className="mb-8 text-lg text-white/80 md:text-xl">{tCommon('description')}</p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="/play"
                className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700 sm:w-auto"
              >
                {t('hero.cta')}
                <FaArrowRight className="ml-2" aria-hidden="true" />
              </Link>
              <Link
                href="/about"
                className="inline-flex w-full items-center justify-center rounded-lg bg-white px-6 py-3 font-semibold text-gray-900 transition-colors hover:bg-gray-100 sm:w-auto"
              >
                {t('hero.secondary')}
                <FaArrowRight className="ml-2" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <h2 className="mb-8 text-2xl font-bold text-gray-900 dark:text-gray-100">{t('points.title')}</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {points.map((point) => (
            <div
              key={point}
              className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
            >
              <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-gray-100">
                {t(`points.${point}.title`)}
              </h3>
              <p className="text-gray-600 dark:text-gray-300">{t(`points.${point}.body`)}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
