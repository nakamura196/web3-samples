import { setRequestLocale, getTranslations } from 'next-intl/server';
import PageLayout from '@/samples/minisig/components/layout/PageLayout';
import MiniSigClient from '@/samples/minisig/components/page/minisig/MiniSigClient';
import { TwoHopFigure } from '@/samples/minisig/components/figures';
import { getPageMetadata } from '@/samples/minisig/constants/metadata';
import type { Metadata } from 'next';

type Props = { params: Promise<{ locale: 'ja' | 'en' }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'minisig.MiniSig' });
  return getPageMetadata(locale, { title: t('title'), description: t('description') });
}

export default async function MiniSigPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'minisig.MiniSig' });

  return (
    <PageLayout
      title={t('title')}
      description={t('description')}
      breadcrumbItems={[{ title: t('title') }]}
    >
      <p className="mb-6 rounded-lg border border-amber-400/60 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        {t('warning')}
      </p>
      <div className="max-w-3xl">
        <TwoHopFigure />
      </div>

      <MiniSigClient />
    </PageLayout>
  );
}
