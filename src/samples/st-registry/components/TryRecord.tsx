'use client';

/**
 * 記録を試す。
 *
 * ここが「web3 で何ができるか」のいちばん分かりやすい場所だと思う。
 * 読むだけなら普通のウェブでもできる。**誰の許可も得ずに書き込めて、
 * それでも決められた語彙に反すれば拒否される** ── これはチェーンでないと作れない。
 *
 *   記録は開放してある(openRecording)。誰でも書ける。
 *   しかし語彙の検証は変わらない。「稼働率に登記簿」は誰が送っても弾かれる。
 *   「誰が書けるか」と「何を書けるか」は別の話で、この試作が示したいのは後者。
 */
import { useState } from 'react';
import { createWalletClient, custom, BaseError, ContractFunctionRevertedError } from 'viem';
import {
  publicClient,
  CHAIN,
  ADDR,
  REGISTRY_ABI,
  EXPLORER,
  BASIS_LABEL,
  FIELD_LABEL,
  toBytes32,
  fromBytes32,
} from '@/samples/st-registry/lib/chain';

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
declare global {
  interface Window {
    ethereum?: Eth;
  }
}

/** 試せる組み合わせ。語彙が通すもの / 弾くものを両方置く。 */
const PRESETS = [
  { field: 'grossFloorArea', basis: 'REGISTRY', value: '20148.41', ok: true },
  { field: 'grossFloorArea', basis: 'INSPECTION', value: '20148.41', ok: true },
  { field: 'occupancy', basis: 'BY_AREA', value: '96.9', ok: true },
  { field: 'occupancy', basis: 'REGISTRY', value: '96.9', ok: false },
  { field: 'occupancy', basis: '', value: '96.9', ok: false },
  { field: 'landArea', basis: 'BY_AREA', value: '20570.05', ok: false },
];

const SCALE = 100n;

export function TryRecord({ labels }: { labels: Record<string, string> }) {
  const [account, setAccount] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  const [state, setState] = useState<{ kind: 'ok' | 'no' | 'wait'; text: string; tx?: string } | null>(
    null,
  );

  async function connect() {
    if (!window.ethereum) {
      setState({ kind: 'no', text: labels.noWallet });
      return;
    }
    const accs = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
    // Sapphire Testnet に切り替える(無ければ追加する)
    const hexId = `0x${CHAIN.id.toString(16)}`;
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexId }] });
    } catch {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: hexId,
            chainName: CHAIN.name,
            nativeCurrency: CHAIN.nativeCurrency,
            rpcUrls: [CHAIN.rpcUrls.default.http[0]],
          },
        ],
      });
    }
    setAccount(accs[0]);
    setState(null);
  }

  async function send() {
    if (!account || !window.ethereum) return;
    const p = PRESETS[sel];
    setState({ kind: 'wait', text: labels.sending });
    try {
      const wallet = createWalletClient({ chain: CHAIN, transport: custom(window.ethereum) });
      const hash = await wallet.writeContract({
        account: account as `0x${string}`,
        address: ADDR.registry,
        abi: REGISTRY_ABI,
        functionName: 'record',
        args: [
          toBytes32('SANDBOX'),
          toBytes32(p.field),
          BigInt(Math.round(parseFloat(p.value) * Number(SCALE))),
          p.basis ? toBytes32(p.basis) : `0x${'0'.repeat(64)}`,
          BigInt(Math.floor(Date.now() / 1000)),
        ],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setState({ kind: 'ok', text: labels.accepted, tx: hash });
    } catch (err) {
      let text = labels.rejected;
      if (err instanceof BaseError) {
        const rev = err.walk((e) => e instanceof ContractFunctionRevertedError);
        if (rev instanceof ContractFunctionRevertedError) {
          const nm = rev.data?.errorName ?? '';
          const args = (rev.data?.args ?? []).map((a) =>
            typeof a === 'string' && a.startsWith('0x') ? fromBytes32(a) : String(a),
          );
          text = `revert ${nm}(${args.join(', ')})`;
        } else if (err.shortMessage) {
          text = err.shortMessage;
        }
      }
      setState({ kind: 'no', text });
    }
  }

  const p = PRESETS[sel];

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-t-4 border-t-blue-800 p-4 flex flex-col gap-3">
      <div>
        <div className="font-mono text-xs tracking-widest uppercase text-blue-800 dark:text-blue-300">
          write
        </div>
        <div className="font-bold">{labels.title}</div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 max-w-2xl">{labels.lead}</p>
      </div>

      {!account ? (
        <button
          onClick={connect}
          className="self-start bg-blue-800 hover:brightness-110 text-white font-semibold text-sm rounded px-3 py-1.5"
        >
          {labels.connect}
        </button>
      ) : (
        <div className="font-mono text-xs text-gray-500 dark:text-gray-400">
          {account.slice(0, 6)}…{account.slice(-4)} · {CHAIN.name}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {PRESETS.map((x, i) => (
          <label
            key={i}
            className={`flex items-center gap-2 text-sm px-2 py-1.5 border cursor-pointer ${
              sel === i
                ? 'border-blue-700 bg-blue-50 dark:bg-blue-950/50'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <input
              type="radio"
              name="preset"
              checked={sel === i}
              onChange={() => {
                setSel(i);
                setState(null);
              }}
            />
            <span className="font-mono text-xs">
              {FIELD_LABEL[x.field]?.ja ?? x.field} = {x.value}
            </span>
            <span className="text-gray-400">/</span>
            <span className="font-mono text-xs">
              {x.basis ? (BASIS_LABEL[x.basis]?.ja ?? x.basis) : labels.noBasis}
            </span>
            <span
              className={`ml-auto font-mono text-[0.65rem] px-1.5 py-0.5 border rounded-sm ${
                x.ok
                  ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                  : 'border-red-600 text-red-700 dark:text-red-400'
              }`}
            >
              {x.ok ? labels.expectOk : labels.expectNo}
            </span>
          </label>
        ))}
      </div>

      <button
        onClick={send}
        disabled={!account || state?.kind === 'wait'}
        className="self-start bg-blue-800 hover:brightness-110 disabled:opacity-40 text-white font-semibold text-sm rounded px-3 py-1.5"
      >
        {labels.send}
      </button>

      {state && (
        <div
          className={`font-mono text-xs px-3 py-2 border-l-4 ${
            state.kind === 'ok'
              ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : state.kind === 'no'
                ? 'border-red-600 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300'
                : 'border-gray-400 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300'
          }`}
        >
          {state.text}
          {state.tx && EXPLORER && (
            <>
              {' '}
              <a
                className="underline"
                href={`${EXPLORER}/tx/${state.tx}`}
                target="_blank"
                rel="noreferrer"
              >
                {state.tx.slice(0, 10)}…
              </a>
            </>
          )}
        </div>
      )}

      <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">{labels.note}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-2xl">
        {labels.selected} {p.ok ? labels.expectOk : labels.expectNo}
      </p>
    </div>
  );
}
