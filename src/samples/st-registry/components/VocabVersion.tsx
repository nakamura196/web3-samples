'use client';

/**
 * 語彙の版。
 *
 * **既に記録された値を遡って無効にしない。** v1 の規則で検証された値は
 * v1 の値として残る。記述はその時々の規則の下で作られる、という
 * アーカイブの原則をそのまま契約に持ち込んでいる。
 * 後から規則を変えて過去の記述を否定すると、何が正しかったのかが分からなくなる。
 */
import { useEffect, useState } from 'react';
import { publicClient, ADDR, REGISTRY_ABI } from '@/samples/st-registry/lib/chain';

export function VocabVersion({ labels }: { labels: Record<string, string> }) {
  const [v, setV] = useState<number | null>(null);

  useEffect(() => {
    publicClient
      .readContract({ address: ADDR.registry, abi: REGISTRY_ABI, functionName: 'vocabVersion' })
      .then((x) => setV(Number(x)))
      .catch(() => setV(null));
  }, []);

  return (
    <div className="border-l-4 border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 max-w-3xl flex flex-col gap-1.5">
      <div className="flex items-baseline gap-3">
        <span className="font-bold text-sm">{labels.title}</span>
        <span className="font-mono text-sm text-blue-800 dark:text-blue-300">
          {v === null ? '…' : `v${v}`}
        </span>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300">{labels.body}</p>
    </div>
  );
}
