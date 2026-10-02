'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  createWalletClient,
  custom,
  formatEther,
  parseEther,
  recoverMessageAddress,
  type Address,
  type Hex,
} from 'viem';
import { CHAIN, DEFAULT_ADDRESS, explorerAddr, explorerTx, publicClient } from '@/samples/minisig/lib/minisig';

type State = {
  owners: readonly Address[];
  threshold: bigint;
  nonce: bigint;
  balance: bigint;
};

type ApiProposal = {
  id: string;
  to: Address;
  value: string;
  data: Hex;
  txHash: Hex;
  nonce: string;
  signatures: { signer: Address; signature: Hex }[];
  ready?: boolean;
  stale?: boolean;
};

const card =
  'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-5 mb-5';
const label = 'block text-sm text-gray-600 dark:text-gray-400 mb-1';
const input =
  'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 ' +
  'px-3 py-2 font-mono text-xs text-gray-900 dark:text-gray-100 break-all';
const btn =
  'mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 ' +
  'disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed';
const mono = 'font-mono text-xs break-all';

/** API を叩いて JSON を型付きで返す。失敗時は error を投げる。 */
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const d = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(d.error ?? r.statusText);
  return d;
}

const postJson = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export default function MiniSigClient() {
  const t = useTranslations('minisig.MiniSig');

  const [account, setAccount] = useState<Address | null>(null);
  const [contract, setContract] = useState<Address>(DEFAULT_ADDRESS);
  const [state, setState] = useState<State | null>(null);

  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('0.0001');

  const [proposal, setProposal] = useState<ApiProposal | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  // ------------------------------------------------------------ read state

  const loadState = useCallback(async (addr: Address): Promise<State> => {
    const d = await api<{
      owners: Address[];
      threshold: number;
      nonce: number;
      balanceWei: string;
    }>(`/api/minisig/${addr}`);
    return {
      owners: d.owners,
      threshold: BigInt(d.threshold),
      nonce: BigInt(d.nonce),
      balance: BigInt(d.balanceWei),
    };
  }, []);

  /** 手動の再取得（実行後やチェーン切り替え時に呼ぶ） */
  const refresh = useCallback(async () => {
    setError(null);
    try {
      setState(await loadState(contract));
    } catch (e) {
      setState(null);
      setError(`${t('errRead')}: ${(e as Error).message}`);
    }
  }, [contract, loadState, t]);

  // 初回とアドレス変更時。
  // 取得中にアドレスが変わったら結果を捨てる（古い応答が新しい状態を上書きするのを防ぐ）
  useEffect(() => {
    let cancelled = false;
    loadState(contract)
      .then((s) => {
        if (!cancelled) setState(s);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setState(null);
          setError(`${t('errRead')}: ${e.message}`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [contract, loadState, t]);

  // MetaMask 側の切り替えに追従する
  useEffect(() => {
    const eth = (globalThis as unknown as { ethereum?: EthProvider }).ethereum;
    if (!eth) return;

    eth
      .request({ method: 'eth_accounts' })
      .then((as) => {
        if (Array.isArray(as) && as.length) setAccount(as[0] as Address);
      })
      .catch(() => {});

    const onAccounts = (as: unknown) =>
      setAccount(Array.isArray(as) && as.length ? (as[0] as Address) : null);
    const onChain = () => refresh();

    eth.on?.('accountsChanged', onAccounts);
    eth.on?.('chainChanged', onChain);
    return () => {
      eth.removeListener?.('accountsChanged', onAccounts);
      eth.removeListener?.('chainChanged', onChain);
    };
  }, [refresh]);

  // ---------------------------------------------------------------- wallet

  const wallet = () => {
    const eth = (globalThis as unknown as { ethereum?: EthProvider }).ethereum;
    if (!eth) throw new Error(t('errNoWallet'));
    return createWalletClient({ chain: CHAIN, transport: custom(eth) });
  };

  async function connect() {
    setError(null);
    try {
      const w = wallet();
      const [addr] = await w.requestAddresses();
      try {
        await w.switchChain({ id: CHAIN.id });
      } catch {
        await w.addChain({ chain: CHAIN });
      }
      setAccount(addr);
    } catch (e) {
      setError((e as Error).message.split('\n')[0]);
    }
  }

  // ------------------------------------------------------- API 経由の操作

  async function createProposal() {
    setBusy(t('busyPropose'));
    setError(null);
    setSent(null);
    try {
      const d = await api<ApiProposal>(
        `/api/minisig/${contract}/proposals`,
        postJson({ to, value: parseEther(amount).toString() })
      );
      setProposal(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function sign() {
    if (!proposal || !account) return;
    setBusy(t('busySign'));
    setError(null);
    try {
      const signature = await wallet().signMessage({
        account,
        message: { raw: proposal.txHash },
      });
      // 復元は API 側でも行うが、先に弾いて無駄な往復を避ける
      const signer = await recoverMessageAddress({ message: { raw: proposal.txHash }, signature });
      if (!state?.owners.some((o) => o.toLowerCase() === signer.toLowerCase())) {
        throw new Error(`${t('errNotOwnerSig')}: ${signer}`);
      }
      await api(
        `/api/minisig/${contract}/proposals/${proposal.id}/signatures`,
        postJson({ signature })
      );
      await reloadProposal();
    } catch (e) {
      setError((e as Error).message.split('\n')[0]);
    } finally {
      setBusy(null);
    }
  }

  async function reloadProposal() {
    if (!proposal) return;
    try {
      setProposal(await api<ApiProposal>(`/api/minisig/${contract}/proposals/${proposal.id}`));
    } catch {
      /* 一覧の再取得に失敗しても致命的ではない */
    }
  }

  async function execute() {
    if (!proposal || !account) return;
    setBusy(t('busyExec'));
    setError(null);
    try {
      // API は「送れる状態の calldata」を返すだけ。送信は鍵を持つ側の仕事。
      const d = await api<{ to: Address; data: Hex }>(
        `/api/minisig/${contract}/proposals/${proposal.id}/calldata`
      );

      const hash = await wallet().sendTransaction({
        account,
        chain: CHAIN,
        to: d.to,
        data: d.data,
        value: BigInt(0),
      });
      setSent(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh();
      await reloadProposal();
    } catch (e) {
      setError((e as Error).message.split('\n')[0]);
    } finally {
      setBusy(null);
    }
  }

  // ------------------------------------------------------------------ view

  const signed = proposal?.signatures ?? [];
  const enough = state ? BigInt(signed.length) >= state.threshold : false;
  const isOwner =
    account && state?.owners.some((o) => o.toLowerCase() === account.toLowerCase());
  const alreadySigned =
    account && signed.some((s) => s.signer.toLowerCase() === account.toLowerCase());

  // 入力の検証
  const toValid = /^0x[0-9a-fA-F]{40}$/.test(to);
  const toIsSelf = toValid && to.toLowerCase() === contract.toLowerCase();
  let amountWei: bigint | null = null;
  try {
    amountWei = amount ? parseEther(amount) : null;
  } catch {
    amountWei = null;
  }
  const overBalance = !!(state && amountWei !== null && amountWei > state.balance);

  return (
    <div className="max-w-3xl">
      {/* wallet */}
      <section className={card}>
        <h2 className="mb-3 text-lg font-semibold">{t('wallet')}</h2>
        {account ? (
          <p className={mono}>
            {account}{' '}
            {isOwner ? (
              <span className="text-green-600 dark:text-green-400">{t('isOwner')}</span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">{t('notOwner')}</span>
            )}
          </p>
        ) : (
          <button className={btn} onClick={connect}>
            {t('connect')}
          </button>
        )}
      </section>

      {/* contract */}
      <section className={card}>
        <h2 className="mb-3 text-lg font-semibold">{t('contract')}</h2>
        <input
          className={input}
          value={contract}
          spellCheck={false}
          onChange={(e) => setContract(e.target.value.trim() as Address)}
        />
        {state && (
          <dl className="mt-4 space-y-2 text-sm">
            <Row k={t('balance')} v={`${formatEther(state.balance)} ETH`} />
            <Row k={t('threshold')} v={`${state.threshold} / ${state.owners.length}`} />
            <Row k="nonce" v={state.nonce.toString()} />
            <div>
              <dt className="text-gray-500 dark:text-gray-400">{t('owners')}</dt>
              <dd className={mono}>
                {state.owners.map((o) => (
                  <div key={o}>{o}</div>
                ))}
              </dd>
            </div>
          </dl>
        )}
        <a
          className="mt-3 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
          href={explorerAddr(contract)}
          target="_blank"
          rel="noreferrer"
        >
          {t('viewExplorer')}
        </a>
      </section>

      {/* 1. propose */}
      <section className={card}>
        <h2 className="mb-3 text-lg font-semibold">{t('step1')}</h2>
        <p className="mb-4 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          {t('step1Help')}
        </p>

        {/* 所有者から選ばせる。空欄に 0x を手入力させない */}
        {state && (
          <div className="mb-4">
            <p className={label}>{t('pickOwner')}</p>
            <div className="flex flex-wrap gap-2">
              {state.owners.map((o, i) => {
                const me = account?.toLowerCase() === o.toLowerCase();
                const active = to.toLowerCase() === o.toLowerCase();
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setTo(o)}
                    className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors ${
                      active
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {t('owner')} {i + 1}
                    {me && ` (${t('you')})`} · {o.slice(0, 6)}…{o.slice(-4)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <label className={label}>{t('to')}</label>
        <input
          className={input}
          value={to}
          placeholder="0x..."
          spellCheck={false}
          onChange={(e) => setTo(e.target.value.trim())}
        />
        {to && !toValid && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{t('warnBadAddress')}</p>
        )}
        {toIsSelf && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{t('warnSelf')}</p>
        )}

        <div className="mt-4 flex items-end gap-3">
          <div className="flex-1">
            <label className={label}>{t('amount')}</label>
            <input
              className={input}
              value={amount}
              onChange={(e) => setAmount(e.target.value.trim())}
            />
          </div>
          {state && (
            <button
              type="button"
              onClick={() => setAmount(formatEther(state.balance))}
              className="mb-0.5 shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {t('useMax')}
            </button>
          )}
        </div>
        {state && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t('max')}: {formatEther(state.balance)} ETH — {t('amountHint')}
          </p>
        )}
        {overBalance && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{t('warnOverBalance')}</p>
        )}

        <button
          className={btn}
          onClick={createProposal}
          disabled={!state || !toValid || amountWei === null || overBalance}
        >
          {t('propose')}
        </button>
        {proposal && (
          <p className="mt-3 text-sm">
            <span className="text-gray-500 dark:text-gray-400">{t('txHashNote')}</span>
            <br />
            <code className={mono}>{proposal.txHash}</code>
          </p>
        )}
      </section>

      {/* 2. sign */}
      <section className={card}>
        <h2 className="mb-3 text-lg font-semibold">{t('step2')}</h2>
        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">{t('collectNote')}</p>

        {state && proposal && (
          <ul className="mb-3 space-y-1 text-sm">
            {state.owners.map((o) => {
              const done = signed.some((s) => s.signer.toLowerCase() === o.toLowerCase());
              const me = account?.toLowerCase() === o.toLowerCase();
              return (
                <li
                  key={o}
                  className={done ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}
                >
                  {done ? t('signed') : t('unsigned')} <code className={mono}>{o}</code>
                  {me && <span className="text-amber-600 dark:text-amber-400"> {t('connected')}</span>}
                </li>
              );
            })}
          </ul>
        )}

        <button className={btn} onClick={sign} disabled={!proposal || !account || !!alreadySigned}>
          {alreadySigned ? t('switchAccount') : t('signWithKey')}
        </button>

        {state && proposal && (
          <p className={`mt-3 text-sm ${enough ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {signed.length} / {state.threshold.toString()} — {enough ? t('canExecute') : t('needMore')}
          </p>
        )}
      </section>

      {/* 3. execute */}
      <section className={card}>
        <h2 className="mb-3 text-lg font-semibold">{t('step3')}</h2>
        <button className={btn} onClick={execute} disabled={!enough || !account}>
          {t('execute')}
        </button>
        {sent && (
          <p className="mt-3 text-sm text-green-600 dark:text-green-400">
            <a href={explorerTx(sent)} target="_blank" rel="noreferrer" className={mono}>
              {sent}
            </a>
          </p>
        )}
      </section>

      {busy && <p className="text-sm text-blue-600 dark:text-blue-400">{busy}…</p>}
      {error && (
        <p className="rounded-lg border border-red-400 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-gray-500 dark:text-gray-400">{k}</dt>
      <dd className="text-gray-900 dark:text-gray-100">{v}</dd>
    </div>
  );
}

type EthProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, cb: (arg: unknown) => void) => void;
  removeListener?: (event: string, cb: (arg: unknown) => void) => void;
};
