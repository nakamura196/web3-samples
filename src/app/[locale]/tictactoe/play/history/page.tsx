import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import PageLayout from '@/samples/tictactoe/components/layout/PageLayout';
import History from '@/samples/tictactoe/components/page/play/History';
import { getPageMetadata } from '@/samples/tictactoe/constants/metadata';
import { routing } from '@/samples/tictactoe/nav';

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
  const t = await getTranslations({ locale: activeLocale, namespace: 'tictactoe.Play.history' });
  return getPageMetadata(activeLocale, { title: t('title'), description: t('description') });
}

export default async function HistoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'tictactoe.Play' });

  return (
    <PageLayout
      title={t('history.title')}
      description={t('history.description')}
      breadcrumbItems={[{ title: t('title'), href: '/play' }, { title: t('history.title') }]}
    >
      <History />
    </PageLayout>
  );
}
