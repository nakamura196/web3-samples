import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import PageLayout from '@/samples/tictactoe/components/layout/PageLayout';
import SoloGame from '@/samples/tictactoe/components/page/play/SoloGame';
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
  const t = await getTranslations({ locale: activeLocale, namespace: 'tictactoe.Play.solo' });
  return getPageMetadata(activeLocale, { title: t('title'), description: t('description') });
}

export default async function SoloPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'tictactoe.Play' });

  return (
    <PageLayout
      title={t('solo.title')}
      description={t('solo.description')}
      breadcrumbItems={[{ title: t('title'), href: '/play' }, { title: t('solo.title') }]}
    >
      <SoloGame />
    </PageLayout>
  );
}
