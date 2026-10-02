import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import PageLayout from '@/samples/tictactoe/components/layout/PageLayout';
import SoloGameDetail from '@/samples/tictactoe/components/page/play/SoloGameDetail';

export default async function SoloGamePage({
  params,
}: {
  params: Promise<{ locale: string; gameId: string }>;
}) {
  const { locale, gameId } = await params;
  setRequestLocale(locale);

  if (!/^\d+$/.test(gameId)) notFound();

  const t = await getTranslations({ locale, namespace: 'tictactoe.Play' });

  return (
    <PageLayout
      title={t('solo.detailHeading', { gameId })}
      breadcrumbItems={[
        { title: t('title'), href: '/play' },
        { title: t('solo.title'), href: '/play/solo' },
        { title: `#${gameId}` },
      ]}
    >
      <SoloGameDetail gameId={BigInt(gameId)} />
    </PageLayout>
  );
}
