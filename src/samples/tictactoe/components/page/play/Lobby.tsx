'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { useTranslations } from 'next-intl';

import { Link } from '@/samples/tictactoe/nav';
import ConnectWallet from '@/samples/tictactoe/components/web3/ConnectWallet';
import CreateGameForm from '@/samples/tictactoe/components/page/play/CreateGameForm';
import GameList from '@/samples/tictactoe/components/page/play/GameList';
import PendingBalance from '@/samples/tictactoe/components/page/play/PendingBalance';
import { useMounted } from '@/samples/tictactoe/lib/useMounted';

export default function Lobby() {
  const t = useTranslations('tictactoe.Play');
  const mounted = useMounted();
  const { isConnected } = useAccount();
  const queryClient = useQueryClient();

  // A new game changes gameCount and the page of games at once; dropping the
  // whole cache is simpler than naming each affected read.
  const handleCreated = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  return (
    <div className="flex flex-col gap-8">
      <ConnectWallet />

      <div>
        <Link
          href="/play/solo"
          className="inline-block rounded-xl border border-gray-300 px-4 py-3 text-sm transition-colors hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          {t('soloLink')} →
        </Link>
      </div>

      {/* Three states, not two. Rendering the full form on the server and then
          swapping it for the prompt after hydration makes the page flash. */}
      {!mounted ? (
        <div className="h-64 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
      ) : !isConnected ? (
        <p className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {t('connectPrompt')}
        </p>
      ) : (
        <>
          <PendingBalance />
          <CreateGameForm onCreated={handleCreated} />
          <GameList />
        </>
      )}
    </div>
  );
}
