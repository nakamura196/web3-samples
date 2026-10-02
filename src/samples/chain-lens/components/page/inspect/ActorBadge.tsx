import { getTranslations } from 'next-intl/server';
import type { Actor } from '@/samples/chain-lens/lib/inspect';

// アドレスの下に「これは何者か」を出す。汎用 explorer との差はここに集約している。
export default async function ActorBadge({
  actor,
  compact = false,
}: {
  actor?: Actor;
  compact?: boolean;
}) {
  const t = await getTranslations('chain-lens.Inspect');
  if (!actor) return null;

  const kind = actor.isContract ? t('actor.contract') : t('actor.eoa');
  const detail = actor.isContract ? t('actor.code', { bytes: actor.codeBytes }) : null;
  const role = actor.role ? t(`roles.${actor.role}`) : null;

  return (
    <div className={compact ? 'mt-0.5' : 'mt-1'}>
      <span className="inline-flex flex-wrap items-center gap-x-2 text-xs">
        <span
          className={
            actor.isContract
              ? 'rounded bg-purple-100 px-1.5 py-0.5 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200'
              : 'rounded bg-sky-100 px-1.5 py-0.5 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200'
          }
        >
          {kind}
        </span>
        {detail && <span className="text-black/45 dark:text-white/45">{detail}</span>}
        {actor.createdHere && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            {t('actor.createdHere')}
          </span>
        )}
      </span>
      {role && (
        <p className={`${compact ? 'text-xs' : 'text-xs'} mt-1 text-black/65 dark:text-white/65`}>
          {role}
        </p>
      )}
    </div>
  );
}
