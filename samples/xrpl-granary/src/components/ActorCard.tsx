'use client';

import { BASE_RESERVE_XRP, OWNER_RESERVE_XRP, explorerAccount, type Snapshot } from '@/lib/ledger';
import type { Actor } from '@/lib/scenario';
import { Badge, ExtLink, Mono, abbrev } from './ui';

const ROLE_TINT: Record<string, string> = {
  kuramoto: 'border-l-accent',
  han: 'border-l-ok',
  nakagai: 'border-l-warn',
};

export function ActorCard({ actor, snap }: { actor: Actor; snap?: Snapshot }) {
  const reserved = snap ? BASE_RESERVE_XRP + snap.owners * OWNER_RESERVE_XRP : null;
  const grn = snap ? Number(snap.grn) : 0;

  return (
    <div
      className={`rounded-lg border border-l-4 border-border bg-surface p-4 ${ROLE_TINT[actor.role] ?? ''}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{actor.name}</h3>
        <Badge>{actor.role}</Badge>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">{actor.historical}</p>

      <div className="mt-3">
        <ExtLink href={explorerAccount(actor.wallet.address)}>
          <Mono>{abbrev(actor.wallet.address, 8)}</Mono>
        </ExtLink>
      </div>

      <dl className="mt-3 space-y-1 text-xs">
        <div className="flex justify-between">
          <dt className="text-ink-soft">XRP</dt>
          <dd className="font-mono">{snap?.xrp ?? '—'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-soft">米切手 (石)</dt>
          <dd className={`font-mono ${grn < 0 ? 'text-err' : grn > 0 ? 'text-ok' : ''}`}>
            {snap ? snap.grn : '—'}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-soft">予約金 (占有 {snap?.owners ?? 0} 件)</dt>
          <dd className="font-mono">{reserved !== null ? `${reserved.toFixed(1)} XRP` : '—'}</dd>
        </div>
      </dl>

      {grn < 0 && (
        <p className="mt-2 rounded bg-surface-2 p-2 text-[11px] leading-relaxed text-ink-soft">
          発行体の残高はマイナスで表示される。発行された切手は、そのまま
          蔵屋敷の<strong>負債</strong>だからである。
        </p>
      )}
    </div>
  );
}
