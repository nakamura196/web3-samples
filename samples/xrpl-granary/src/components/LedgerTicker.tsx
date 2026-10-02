'use client';

import { useEffect, useState } from 'react';
import { getClient } from '@/lib/ledger';
import { Badge } from './ui';

/**
 * レジャーのクローズを購読して表示する。
 *
 * 「3〜5 秒でクローズし、その時点で確定」という XRPL の主張は、
 * 説明されるより秒針が動くのを見るほうが早い。
 */
export function LedgerTicker() {
  const [seq, setSeq] = useState<number | null>(null);
  const [gap, setGap] = useState<number | null>(null);
  const [txns, setTxns] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let last = 0;
    let cleanup = () => {};

    (async () => {
      try {
        const client = await getClient();
        if (cancelled) return;
        const onLedger = (l: { ledger_index: number; txn_count: number }) => {
          const now = Date.now();
          if (last) setGap((now - last) / 1000);
          last = now;
          setSeq(l.ledger_index);
          setTxns(l.txn_count);
        };
        client.on('ledgerClosed', onLedger);
        await client.request({ command: 'subscribe', streams: ['ledger'] });
        cleanup = () => {
          client.off('ledgerClosed', onLedger);
        };
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  if (error) return <Badge tone="err">testnet 接続エラー</Badge>;
  if (seq === null) return <Badge>testnet 接続中…</Badge>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone="ok">● testnet 接続中</Badge>
      <Badge>ledger #{seq.toLocaleString()}</Badge>
      {gap !== null && <Badge tone="accent">クローズ間隔 {gap.toFixed(1)}s</Badge>}
      {txns !== null && <Badge>このレジャー {txns} tx</Badge>}
    </div>
  );
}
