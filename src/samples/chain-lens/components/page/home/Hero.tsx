import { FaArrowRight } from 'react-icons/fa';
import { Link } from '@/samples/chain-lens/nav';
import { getTranslations } from 'next-intl/server';
import { SAMPLES } from '@/samples/chain-lens/constants/samples';

export default async function Hero() {
  const t = await getTranslations('chain-lens.HomePage');
  const tCommon = await getTranslations('chain-lens.Common');

  return (
    <section className="relative bg-gray-900">
      {/* 学習ツールなので、無関係なストック写真ではなく落ち着いた背景にする。
          外部ホストの画像を読まない分、表示も確実になる。 */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900" />
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-20 md:py-28">
          <div className="max-w-3xl">
            <h1 className="mb-6 text-4xl font-bold text-white md:text-5xl">{tCommon('title')}</h1>
            <p className="mb-8 text-lg text-white/85 md:text-xl">{tCommon('description')}</p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href={{ pathname: '/inspect', query: { tx: SAMPLES[0].hash } }}
                className="inline-flex w-full items-center justify-center rounded-lg bg-white px-6 py-3 font-semibold text-gray-900 transition-colors hover:bg-gray-100 sm:w-auto"
              >
                {t('hero.secondary')}
                <FaArrowRight className="ml-2" aria-hidden="true" />
              </Link>
              <Link
                href="/inspect"
                className="inline-flex w-full items-center justify-center rounded-lg border border-white/40 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
              >
                {t('hero.cta')}
                <FaArrowRight className="ml-2" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
