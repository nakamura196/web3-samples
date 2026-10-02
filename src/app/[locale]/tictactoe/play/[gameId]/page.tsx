import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import PageLayout from '@/samples/tictactoe/components/layout/PageLayout';
import GameView from '@/samples/tictactoe/components/page/play/GameView';

/**
 * Rendered on demand: game ids are created by players at runtime, so there is
 * no static set to pre-render.
 */
export default async function GamePage({
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
      title={t('game.heading', { gameId })}
      breadcrumbItems={[{ title: t('title'), href: '/play' }, { title: `#${gameId}` }]}
    >
      <GameView gameId={BigInt(gameId)} />
    </PageLayout>
  );
}
