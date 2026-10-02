import { routing } from '@/samples/minisig/nav';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import PageLayout from '@/samples/minisig/components/layout/PageLayout';
import { getPageMetadata } from '@/samples/minisig/constants/metadata';
import { CHAIN_INFO, DEPLOYMENTS, LINKS } from '@/samples/minisig/constants/site';
import type { Metadata } from 'next';

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const l = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: l, namespace: 'minisig.About' });
  return getPageMetadata(l, { title: t('title'), description: t('description') });
}

export default async function About({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: l, namespace: 'minisig.About' });

  const card = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6 mb-6';

  return (
    <PageLayout title={t('title')} description={t('description')} breadcrumbItems={[{ title: t('title') }]}>
      <div className="max-w-3xl">
        <p className="mb-6 rounded-lg border border-amber-400/60 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          {t('warning')}
        </p>

        <section className={card}>
          <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">{t('what.title')}</h2>
          <p className="leading-relaxed text-gray-700 dark:text-gray-300">{t('what.body')}</p>
        </section>

        <section className={card}>
          <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">{t('why.title')}</h2>
          <p className="leading-relaxed text-gray-700 dark:text-gray-300">{t('why.body')}</p>
        </section>

        <section className={card}>
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
            {t('deployments.title')}
          </h2>
          <div className="space-y-4">
            {DEPLOYMENTS.map((d) => (
              <div key={d.address} className="border-b border-gray-200 pb-4 last:border-0 last:pb-0 dark:border-gray-700">
                <a
                  href={`${CHAIN_INFO.explorer}/address/${d.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  {d.address}
                </a>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex gap-3">
                    <dt className="w-32 shrink-0 text-gray-500 dark:text-gray-400">{t('deployments.owners')}</dt>
                    <dd className="text-gray-800 dark:text-gray-200">{d.ownersLabel[l]}</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="w-32 shrink-0 text-gray-500 dark:text-gray-400">{t('deployments.governance')}</dt>
                    <dd className={d.governance ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}>
                      {d.governance ? '✓' : '—'}
                    </dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="w-32 shrink-0 text-gray-500 dark:text-gray-400">{t('deployments.note')}</dt>
                    <dd className="text-gray-700 dark:text-gray-300">{d.note[l]}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        <section className={card}>
          <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100">{t('stack.title')}</h2>
          <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <li>Solidity / <a className="text-blue-600 hover:underline dark:text-blue-400" href={LINKS.foundry} target="_blank" rel="noreferrer">Foundry</a></li>
            <li>Next.js / <a className="text-blue-600 hover:underline dark:text-blue-400" href={LINKS.viem} target="_blank" rel="noreferrer">viem</a></li>
            <li>Cloudflare Workers / KV — <a className="text-blue-600 hover:underline dark:text-blue-400" href={LINKS.opennext} target="_blank" rel="noreferrer">OpenNext</a></li>
            <li><a className="text-blue-600 hover:underline dark:text-blue-400" href={LINKS.template} target="_blank" rel="noreferrer">nextjs-i18n-themes-ssr-template</a></li>
            <li><a className="text-blue-600 hover:underline dark:text-blue-400" href={LINKS.safe} target="_blank" rel="noreferrer">Safe</a></li>
          </ul>
        </section>
      </div>
    </PageLayout>
  );
}
