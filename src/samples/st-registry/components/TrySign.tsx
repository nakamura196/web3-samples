'use client';

/**
 * 署名して申告する。
 *
 * 送信者と申告者を分けられる。アセットマネージャーが値に署名し、
 * 送信は別の誰かがやる ── 記述の来歴としては、送信者よりも
 * **誰が言ったか** のほうが意味を持つ。
 *
 * 値を1文字でも書き換えると、復元される署名者が別人になる。
 * 「この値をこの人が申告した」という結び付きが、署名によって保たれる。
 */
import { useState } from 'react';
import { createWalletClient, custom, BaseError, ContractFunctionRevertedError } from 'viem';
import { publicClient, CHAIN, ADDR, REGISTRY_ABI, EXPLORER, toBytes32 } from '@/samples/st-registry/lib/chain';

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
declare global {
  interface Window { ethereum?: Eth }
}

const EMPTY32 = `0x${'0'.repeat(64)}` as `0x${string}`;

export function TrySign({ labels }: { labels: Record<string, string> }) {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [value, setValue] = useState('20148.41');
  const [sig, setSig] = useState<`0x${string}` | null>(null);
  const [signedValue, setSignedValue] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'no'; text: string; tx?: string } | null>(null);

  const input = (v: string) => ({
    propertyId: toBytes32('SANDBOX'),
    field: toBytes32('grossFloorArea'),
    value: BigInt(Math.round(parseFloat(v || '0') * 100)),
    basis: toBytes32('REGISTRY'),
    asOf: BigInt(Math.floor(Date.now() / 1000)),
    scope: EMPTY32,
    subtype: EMPTY32,
  });

  async function connect() {
    if (!window.ethereum) { setMsg({ kind: 'no', text: labels.noWallet }); return; }
    const accs = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
    await window.ethereum
      .request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${CHAIN.id.toString(16)}` }] })
      .catch(() => {});
    setAccount(accs[0] as `0x${string}`);
  }

  const [payload, setPayload] = useState<ReturnType<typeof input> | null>(null);

  async function sign() {
    if (!account || !window.ethereum) return;
    setMsg(null);
    const i = input(value);
    const wallet = createWalletClient({ chain: CHAIN, transport: custom(window.ethereum) });
    const s = await wallet.signTypedData({
      account,
      domain: { name: 'PropertyRegistry', version: '1', chainId: CHAIN.id, verifyingContract: ADDR.registry },
      types: {
        Measure: [
          { name: 'propertyId', type: 'bytes32' }, { name: 'field', type: 'bytes32' },
          { name: 'value', type: 'uint256' }, { name: 'basis', type: 'bytes32' },
          { name: 'asOf', type: 'uint64' }, { name: 'scope', type: 'bytes32' },
          { name: 'subtype', type: 'bytes32' },
        ],
      },
      primaryType: 'Measure',
      message: i,
    });
    setSig(s);
    setPayload(i);
    setSignedValue(value);
    setMsg({ kind: 'ok', text: labels.signed });
  }

  async function submit(tamper: boolean) {
    if (!account || !sig || !payload || !window.ethereum) return;
    setMsg(null);
    const i = tamper ? { ...payload, value: payload.value + 1n } : payload;
    try {
      const wallet = createWalletClient({ chain: CHAIN, transport: custom(window.ethereum) });
      const hash = await wallet.writeContract({
        account, address: ADDR.registry, abi: REGISTRY_ABI, functionName: 'recordSigned', args: [i, sig],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      const m = (await publicClient.readContract({
        address: ADDR.registry, abi: REGISTRY_ABI, functionName: 'get',
        args: [payload.propertyId, payload.field],
      })) as { attestedBy: string };
      const same = m.attestedBy.toLowerCase() === account.toLowerCase();
      setMsg({
        kind: same ? 'ok' : 'no',
        text: same ? `${labels.attestedYou} ${m.attestedBy}` : `${labels.attestedOther} ${m.attestedBy}`,
        tx: hash,
      });
    } catch (err) {
      let text = labels.failed;
      if (err instanceof BaseError) {
        const rev = err.walk((e) => e instanceof ContractFunctionRevertedError);
        if (rev instanceof ContractFunctionRevertedError) text = `revert ${rev.data?.errorName ?? ''}`;
        else if (err.shortMessage) text = err.shortMessage;
      }
      setMsg({ kind: 'no', text });
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-t-4 border-t-blue-800 p-4 flex flex-col gap-3">
      <div>
        <div className="font-mono text-xs tracking-widest uppercase text-blue-800 dark:text-blue-300">sign</div>
        <div className="font-bold">{labels.title}</div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 max-w-2xl">{labels.lead}</p>
      </div>

      {!account ? (
        <button onClick={connect}
          className="self-start bg-blue-800 hover:brightness-110 text-white font-semibold text-sm rounded px-3 py-1.5">
          {labels.connect}
        </button>
      ) : (
        <div className="font-mono text-xs text-gray-500 dark:text-gray-400">
          {account.slice(0, 6)}…{account.slice(-4)}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <span className="font-mono text-xs">{labels.valueLabel}</span>
        <input value={value} onChange={(e) => { setValue(e.target.value); setSig(null); }}
          className="font-mono text-sm border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1 w-32" />
        <span className="font-mono text-xs text-gray-500">㎡</span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button onClick={sign} disabled={!account}
          className="bg-blue-800 hover:brightness-110 disabled:opacity-40 text-white font-semibold text-sm rounded px-3 py-1.5">
          {labels.sign}
        </button>
        <button onClick={() => submit(false)} disabled={!sig}
          className="border border-blue-800 text-blue-800 dark:text-blue-300 disabled:opacity-40 font-semibold text-sm rounded px-3 py-1.5">
          {labels.submit}
        </button>
        <button onClick={() => submit(true)} disabled={!sig}
          className="border border-red-600 text-red-700 dark:text-red-400 disabled:opacity-40 font-semibold text-sm rounded px-3 py-1.5">
          {labels.tamper}
        </button>
      </div>

      {sig && (
        <div className="font-mono text-xs text-gray-500 dark:text-gray-400 break-all">
          {labels.sigFor} {signedValue} ㎡ · {sig.slice(0, 22)}…
        </div>
      )}

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
