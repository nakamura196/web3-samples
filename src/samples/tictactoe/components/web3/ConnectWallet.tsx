'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain } from 'wagmi';

import {
  SUPPORTED_CHAINS,
  type SupportedChainId,
  deployedChains,
  isSupportedChain,
} from '@/samples/tictactoe/lib/chains';
import { formatStake, shortAddress } from '@/samples/tictactoe/lib/game';
import { addChainToWallet } from '@/samples/tictactoe/lib/addChain';
import { useMounted } from '@/samples/tictactoe/lib/useMounted';
import FaucetHint from '@/samples/tictactoe/components/web3/FaucetHint';

export default function ConnectWallet() {
  const t = useTranslations('tictactoe.Play.wallet');
  const mounted = useMounted();
  const { address, chainId, connector, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const [needsManualSetup, setNeedsManualSetup] = useState(false);
  // Shows what the app itself sees, which is the quickest way to tell a wallet
  // display problem apart from being on the wrong network.
  const { data: balance } = useBalance({ address, query: { refetchInterval: 5_000 } });
  const [busyChain, setBusyChain] = useState<number | null>(null);

  const injectedConnector = connectors.find((c) => c.id === 'injected') ?? connectors[0];

  // Render the neutral state until hydration: the wallet only exists in the browser.
  if (!mounted) {
    return <div className="h-10 w-40 rounded-lg bg-gray-100 dark:bg-gray-800" aria-hidden="true" />;
  }

  if (!injectedConnector) {
    return <p className="text-sm text-amber-700 dark:text-amber-400">{t('noWallet')}</p>;
  }

  if (!isConnected) {
    // Wrapped in a div so the parent's vertical spacing applies. A bare
    // inline-block button would share a line with the next sibling.
    return (
      <div>
        <button
          type="button"
          onClick={() => connect({ connector: injectedConnector })}
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {isPending ? t('connecting') : t('connect')}
        </button>
      </div>
    );
  }

  const onSupportedChain = isSupportedChain(chainId);
  const ready = deployedChains();

  /**
   * Switch first; if the wallet has never heard of the network, offer to add it.
   * A local Anvil node is unknown to every fresh wallet, so this second step is
   * the normal path during development rather than an edge case.
   */
  async function goTo(target: SupportedChainId) {
    const chain = SUPPORTED_CHAINS.find((c) => c.id === target);
    if (!chain) return;

    setNeedsManualSetup(false);
    setBusyChain(target);
    try {
      await switchChainAsync({ chainId: target });
    } catch {
      try {
        await addChainToWallet(await connector?.getProvider(), chain);
        await switchChainAsync({ chainId: target });
      } catch {
        setNeedsManualSetup(true);
      }
    } finally {
      setBusyChain(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={onSupportedChain ? chainId : ''}
          onChange={(event) => void goTo(Number(event.target.value) as SupportedChainId)}
          aria-label={t('network')}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
        >
          {!onSupportedChain && <option value="">{t('unsupportedNetwork')}</option>}
          {SUPPORTED_CHAINS.map((chain) => (
            <option key={chain.id} value={chain.id}>
              {chain.name}
            </option>
          ))}
        </select>

        <span className="rounded-lg bg-gray-100 px-3 py-2 font-mono text-sm dark:bg-gray-800">
          {shortAddress(address)}
        </span>

        {balance && (
          <span
            className="rounded-lg bg-gray-100 px-3 py-2 font-mono text-sm dark:bg-gray-800"
            title={t('balanceHint')}
          >
            {formatStake(balance.value)} {balance.symbol}
          </span>
        )}

        <button
          type="button"
          onClick={() => disconnect()}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          {t('disconnect')}
        </button>
      </div>

      {onSupportedChain && balance?.value === 0n && <FaucetHint chainId={chainId} />}

      {!onSupportedChain && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="mb-3 font-semibold text-amber-900 dark:text-amber-200">{t('wrongNetworkTitle')}</p>
          <p className="mb-3 text-sm text-amber-800 dark:text-amber-300">{t('wrongNetworkBody')}</p>

          {ready.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {ready.map((chain) => (
                <button
                  key={chain.id}
                  type="button"
                  disabled={busyChain !== null}
                  onClick={() => void goTo(chain.id as SupportedChainId)}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
                >
                  {busyChain === chain.id
                    ? t('switching')
                    : t('switchTo', { network: chain.name })}
                </button>
              ))}
            </div>
          )}

          {needsManualSetup && (
            <div className="mt-4 rounded-lg bg-white p-3 text-sm dark:bg-gray-900">
              <p className="mb-2 font-semibold">{t('addManuallyTitle')}</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
                <dt className="text-gray-500">Network</dt>
                <dd>Anvil</dd>
                <dt className="text-gray-500">RPC URL</dt>
                <dd>http://127.0.0.1:8545</dd>
                <dt className="text-gray-500">Chain ID</dt>
                <dd>31337</dd>
                <dt className="text-gray-500">Currency</dt>
                <dd>ETH</dd>
              </dl>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
