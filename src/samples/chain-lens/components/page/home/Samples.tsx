import { getTranslations } from 'next-intl/server';
import { Link } from '@/samples/chain-lens/nav';
import { FaArrowRight, FaExternalLinkAlt } from 'react-icons/fa';
import { SAMPLES, EXPLORERS } from '@/samples/chain-lens/constants/samples';

export default async function Samples() {
  const t = await getTranslations('chain-lens.HomePage');

  return (
    <>
      <section className="container mx-auto px-4 py-16">
        <h2 className="mb-4 text-2xl font-bold">{t('samples.title')}</h2>
        <p className="mb-8 max-w-3xl text-black/70 dark:text-white/70">{t('samples.lead')}</p>

        <div className="grid gap-6 md:grid-cols-2">
          {SAMPLES.map((s) => (
            <div
              key={s.hash}
              className="flex flex-col rounded-lg border border-black/10 p-5 dark:border-white/15"
            >
              <h3 className="mb-2 font-semibold">{t(`samples.${s.key}.title`)}</h3>
              <p className="mb-4 grow text-sm text-black/70 dark:text-white/70">
                {t(`samples.${s.key}.note`)}
              </p>
              <code className="mb-4 block font-mono text-xs break-all text-black/50 dark:text-white/50">
                {s.hash}
              </code>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <Link
                  href={{ pathname: '/inspect', query: { tx: s.hash } }}
                  className="inline-flex items-center font-medium text-blue-700 hover:underline dark:text-blue-400"
                >
                  {t('samples.open')}
                  <FaArrowRight className="ml-1 text-xs" aria-hidden="true" />
                </Link>
                {EXPLORERS.map((e) => (
                  <a
                    key={e.name}
                    href={e.tx(s.hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-black/60 hover:underline dark:text-white/60"
                  >
                    {e.name}
                    <FaExternalLinkAlt className="ml-1 text-[0.6rem]" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03]">
        <div className="container mx-auto px-4 py-16">
          <h2 className="mb-4 text-2xl font-bold">{t('what.title')}</h2>
          <p className="mb-8 max-w-3xl text-black/70 dark:text-white/70">{t('what.lead')}</p>
          <div className="grid gap-6 md:grid-cols-3">
            {(['a', 'b', 'c'] as const).map((k) => (
              <div key={k}>
                <h3 className="mb-2 font-semibold">{t(`what.${k}.title`)}</h3>
                <p className="text-sm text-black/70 dark:text-white/70">{t(`what.${k}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl rounded-lg border border-green-600/30 bg-green-50/60 p-6 dark:bg-green-950/20">
          <h2 className="mb-2 text-lg font-semibold">{t('safety.title')}</h2>
          <p className="text-sm text-black/75 dark:text-white/75">{t('safety.body')}</p>
        </div>
      </section>
    </>
  );
}
