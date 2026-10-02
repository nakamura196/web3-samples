import { routing } from '@/samples/chain-lens/nav';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import PageLayout from '@/samples/chain-lens/components/layout/PageLayout';
import InspectResult from '@/samples/chain-lens/components/page/inspect/InspectResult';
import { getPageMetadata } from '@/samples/chain-lens/constants/metadata';
import { hasLocale } from 'next-intl';
import { inspectTransaction, type Inspection } from '@/samples/chain-lens/lib/inspect';
import type { Metadata } from 'next';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const activeLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: activeLocale, namespace: 'chain-lens.Inspect' });
  return getPageMetadata(activeLocale, { title: t('title'), description: t('description') });
}

// 本書の教材。実際に Sepolia に残っている取引。
const SAMPLES = [
  {
    hash: '0x2b699f1d67904dc675e204702318bf7c4bca9cb53e38ecfaed3252f0cecb9103',
    key: 'metadata',
  },
  {
    hash: '0x2d29cc0626971b6c71bc135e4f68bbe711da1b16f6098664724bf4a7f7f8bc84',
    key: 'create',
  },
] as const;

export default async function InspectPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tx?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { tx } = await searchParams;
  const t = await getTranslations('chain-lens.Inspect');

  let data: Inspection | null = null;
  let error: string | null = null;
  if (tx) {
    try {
      data = await inspectTransaction(tx.trim());
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  return (
    <PageLayout
      breadcrumbItems={[{ title: t('title') }]}
      title={t('title')}
      description={t('description')}
    >
      <div className="mb-6 rounded-lg border border-green-600/30 bg-green-50/60 p-4 text-sm dark:bg-green-950/20">
        <p className="font-medium">{t('safe.title')}</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-black/70 dark:text-white/70">
          <li>{t('safe.noWallet')}</li>
          <li>{t('safe.noKey')}</li>
          <li>{t('safe.testnet')}</li>
        </ul>
      </div>

      <form method="get" className="mb-6">
        <label htmlFor="tx" className="mb-2 block text-sm font-medium">
          {t('form.label')}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="tx"
            name="tx"
            defaultValue={tx ?? ''}
            placeholder="0x…"
            className="min-w-0 flex-1 rounded border border-black/20 bg-transparent px-3 py-2 font-mono text-sm dark:border-white/20"
          />
          <button
            type="submit"
            className="rounded bg-black px-5 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            {t('form.submit')}
          </button>
        </div>
      </form>

      <div className="mb-8">
        <p className="mb-2 text-sm text-black/60 dark:text-white/60">{t('form.samples')}</p>
        <ul className="space-y-1">
          {SAMPLES.map((s) => (
            <li key={s.hash}>
              <a
                href={`?tx=${s.hash}`}
                className="font-mono text-xs text-blue-700 underline dark:text-blue-400"
              >
                {s.hash.slice(0, 20)}…
              </a>
              <span className="ml-2 text-xs text-black/60 dark:text-white/60">
                {t(`form.sample.${s.key}`)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <div className="mb-6 rounded border border-red-600/40 bg-red-50/60 p-4 text-sm dark:bg-red-950/20">
          {error}
        </div>
      )}

      {data && <InspectResult data={data} />}
    </PageLayout>
  );
}
