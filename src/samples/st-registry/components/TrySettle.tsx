'use client';

/**
 * DvP を実際に実行する。
 *
 * 訪問者が買主になる。売主(curator)は配備時に承認済み。
 * 手順が 4 つあるのは、実務の順序をそのまま踏んでいるため。
 *   適格者になる → 代金を用意する → 決済契約に承認する → 決済する
 *
 * 見せたいのは最後の 1 手。**ST の受渡しと代金の支払が、1 つの取引で
 * 同時に確定する。** 途中で止まらないので「引き落としたが入金はこれから」
 * という状態が存在しない。銀行送金にはこれができない。
 */
import { useCallback, useEffect, useState } from 'react';
import { createWalletClient, custom, BaseError, ContractFunctionRevertedError } from 'viem';
import {
  publicClient, CHAIN, ADDR, PROPERTIES, ERC20_ABI, ST_ABI, JPY_ABI, DVP_ABI, VAULT_ABI, EXPLORER,
} from '@/samples/st-registry/lib/chain';

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
declare global {
  interface Window { ethereum?: Eth }
}

const SELLER = '0x5e73312D8F12239BF36f70c2dbeADF9389800C4E' as `0x${string}`;
const ST = PROPERTIES[0].st;
const ST_AMOUNT = 1n;
const PAY_AMOUNT = 1_000_000n;
const YEN = new Intl.NumberFormat('ja-JP');

type Status = { eligible: boolean; jpy: bigint; allowance: bigint; st: bigint };

export function TrySettle({ labels }: { labels: Record<string, string> }) {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [st8, setSt8] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'no'; text: string; tx?: string } | null>(null);

  const refresh = useCallback(async (who: `0x${string}`) => {
    const [eligible, jpy, allowance, st] = await Promise.all([
      publicClient.readContract({ address: ST, abi: ST_ABI, functionName: 'eligible', args: [who] }),
      publicClient.readContract({ address: ADDR.jpy, abi: ERC20_ABI, functionName: 'balanceOf', args: [who] }),
      publicClient.readContract({ address: ADDR.jpy, abi: JPY_ABI, functionName: 'allowance', args: [who, ADDR.dvp] }),
      publicClient.readContract({ address: ST, abi: ERC20_ABI, functionName: 'balanceOf', args: [who] }),
    ]);
    setSt8({ eligible: eligible as boolean, jpy: jpy as bigint, allowance: allowance as bigint, st: st as bigint });
  }, []);

  useEffect(() => {
    if (account) refresh(account).catch(() => {});
  }, [account, refresh]);

  async function connect() {
    if (!window.ethereum) { setMsg({ kind: 'no', text: labels.noWallet }); return; }
    const accs = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
    const hexId = `0x${CHAIN.id.toString(16)}`;
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexId }] });
    } catch {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{ chainId: hexId, chainName: CHAIN.name, nativeCurrency: CHAIN.nativeCurrency,
                   rpcUrls: [CHAIN.rpcUrls.default.http[0]] }],
      });
    }
    setAccount(accs[0] as `0x${string}`);
    setMsg(null);
  }

  async function run(step: string, fn: () => Promise<`0x${string}`>) {
    if (!account) return;
    setBusy(step); setMsg(null);
    try {
      const hash = await fn();
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh(account);
      setMsg({ kind: 'ok', text: labels[`${step}Done`] ?? labels.done, tx: hash });
    } catch (err) {
      let text = labels.failed;
      if (err instanceof BaseError) {
        const rev = err.walk((e) => e instanceof ContractFunctionRevertedError);
        if (rev instanceof ContractFunctionRevertedError) text = `revert ${rev.data?.errorName ?? ''}`;
        else if (err.shortMessage) text = err.shortMessage;
      }
      setMsg({ kind: 'no', text });
    } finally { setBusy(null); }
  }

  const wallet = () =>
    createWalletClient({ chain: CHAIN, transport: custom(window.ethereum!) });

  const steps = [
    {
      id: 'register', label: labels.sRegister, hint: labels.hRegister,
      done: !!st8?.eligible,
      go: () => run('register', () => wallet().writeContract({
        account: account!, address: ST, abi: ST_ABI, functionName: 'selfRegister', args: [] })),
    },
    {
      id: 'mint', label: labels.sMint, hint: labels.hMint,
      done: (st8?.jpy ?? 0n) >= PAY_AMOUNT,
      go: () => run('mint', () => wallet().writeContract({
        account: account!, address: ADDR.jpy, abi: JPY_ABI, functionName: 'mint',
        args: [account!, PAY_AMOUNT * 10n] })),
    },
    {
      id: 'approve', label: labels.sApprove, hint: labels.hApprove,
      done: (st8?.allowance ?? 0n) >= PAY_AMOUNT,
      go: () => run('approve', () => wallet().writeContract({
        account: account!, address: ADDR.jpy, abi: JPY_ABI, functionName: 'approve',
        args: [ADDR.dvp, PAY_AMOUNT * 100n] })),
    },
    {
      id: 'settle', label: labels.sSettle, hint: labels.hSettle,
      done: false,
      go: () => run('settle', () => wallet().writeContract({
        account: account!, address: ADDR.dvp, abi: DVP_ABI, functionName: 'settle',
        args: [ST, ADDR.jpy, SELLER, account!, ST_AMOUNT, PAY_AMOUNT] })),
    },
    {
      // 借入。担保評価が成立する銘柄αでのみ通る。
      // 語彙に反する銘柄βでは、そもそも評価ができないので借りられない。
      id: 'borrow', label: labels.sBorrow, hint: labels.hBorrow,
      done: false,
      go: () => run('borrow', () => wallet().writeContract({
        account: account!, address: ADDR.vault, abi: VAULT_ABI, functionName: 'borrow',
        args: [ST, 1_000_000n] })),
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-t-4 border-t-blue-800 p-4 flex flex-col gap-3">
      <div>
        <div className="font-mono text-xs tracking-widest uppercase text-blue-800 dark:text-blue-300">dvp</div>
        <div className="font-bold">{labels.title}</div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 max-w-2xl">{labels.lead}</p>
      </div>

      {!account ? (
        <button onClick={connect}
          className="self-start bg-blue-800 hover:brightness-110 text-white font-semibold text-sm rounded px-3 py-1.5">
          {labels.connect}
        </button>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-gray-500 dark:text-gray-400">
          <span>{account.slice(0, 6)}…{account.slice(-4)}</span>
          <span>ST {String(st8?.st ?? 0n)}</span>
          <span>JPY ¥{YEN.format(Number(st8?.jpy ?? 0n))}</span>
        </div>
      )}

      <ol className="flex flex-col gap-1.5">
        {steps.map((s, i) => (
          <li key={s.id}
            className={`flex items-center gap-3 px-3 py-2 border ${
              s.done ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                     : 'border-gray-200 dark:border-gray-700'}`}>
            <span className="font-mono text-xs text-gray-400 w-4">{s.done ? '✓' : i + 1}</span>
            <span className="flex flex-col">
              <span className="text-sm font-medium">{s.label}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{s.hint}</span>
            </span>
            <button onClick={s.go} disabled={!account || !!busy || s.done}
              className="ml-auto text-xs font-semibold rounded px-2.5 py-1 bg-blue-800 text-white disabled:opacity-30 hover:brightness-110">
              {busy === s.id ? labels.sending : s.done ? labels.ok : labels.exec}
            </button>
          </li>
        ))}
      </ol>

      {msg && (
        <div className={`font-mono text-xs px-3 py-2 border-l-4 ${
          msg.kind === 'ok'
            ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
            : 'border-red-600 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300'}`}>
          {msg.text}
          {msg.tx && EXPLORER && (
            <> <a className="underline" href={`${EXPLORER}/tx/${msg.tx}`} target="_blank" rel="noreferrer">
              {msg.tx.slice(0, 10)}…</a></>
          )}
        </div>
      )}

      <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">{labels.note}</p>
    </div>
  );
}
