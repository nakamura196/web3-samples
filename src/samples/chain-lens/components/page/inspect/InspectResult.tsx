import { getTranslations } from 'next-intl/server';
import { FaExternalLinkAlt } from 'react-icons/fa';
import type { Inspection, Actor } from '@/samples/chain-lens/lib/inspect';
import { EXPLORERS } from '@/samples/chain-lens/constants/samples';
import ActorBadge from './ActorBadge';

const mono = 'font-mono text-xs break-all';

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-black/10 py-3 last:border-0 sm:flex-row sm:gap-4 dark:border-white/10">
      <div className="w-full shrink-0 text-sm text-black/60 sm:w-44 dark:text-white/60">
        {label}
      </div>
      <div className="min-w-0 flex-1 text-sm">
        {children}
        {hint && <p className="mt-1 text-xs text-black/50 dark:text-white/50">{hint}</p>}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 rounded-lg border border-black/10 p-4 sm:p-6 dark:border-white/10">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function InspectResult({ data }: { data: Inspection }) {
  const t = await getTranslations('chain-lens.Inspect');
  const n = (v: string | number) => Number(v).toLocaleString();

  return (
    <div>
      <Card title={t('result.summary')}>
        <p className="mb-4 text-sm text-black/70 dark:text-white/70">{t('result.summaryLead')}</p>
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-black/50 dark:text-white/50">{t('result.explorer')}:</span>
          {EXPLORERS.map((e) => (
            <a
              key={e.name}
              href={e.tx(data.hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-blue-700 hover:underline dark:text-blue-400"
            >
              {e.name}
              <FaExternalLinkAlt className="ml-1 text-[0.6rem]" aria-hidden="true" />
            </a>
          ))}
        </div>
        <Row label={t('result.status')}>
          <span
            className={
              data.status === 'success'
                ? 'text-green-700 dark:text-green-400'
                : 'text-red-700 dark:text-red-400'
            }
          >
            {data.status === 'success' ? t('result.ok') : t('result.reverted')}
          </span>
        </Row>
        <Row label={t('result.from')} hint={t('hint.from')}>
          <code className={mono}>{data.from}</code>
          <ActorBadge actor={data.actors[data.from.toLowerCase()]} />
        </Row>
        <Row label={t('result.to')} hint={t('hint.to')}>
          <code className={mono}>{data.to ?? '—'}</code>
          {data.to && <ActorBadge actor={data.actors[data.to.toLowerCase()]} />}
        </Row>
        <Row label={t('result.block')} hint={t('hint.block')}>
          {n(data.blockNumber)}
        </Row>
        <Row label={t('result.gas')} hint={t('hint.gas')}>
          {n(data.gasUsed)} × {data.gasPriceGwei} Gwei
        </Row>
        <Row label={t('result.fee')} hint={t('hint.fee')}>
          <strong>{data.feeEth} ETH</strong>
        </Row>
        <Row label={t('result.calldata')} hint={t('hint.calldata')}>
          {n(data.calldataBytes)} {t('result.bytes')}
        </Row>
        <Row label={t('result.logs')} hint={t('hint.logs')}>
          {data.logCount}
        </Row>
      </Card>

      {data.ddo && (
        <Card title={t('ddo.title')}>
          <p className="mb-4 text-sm text-black/70 dark:text-white/70">{t('ddo.lead')}</p>
          <Row label={t('ddo.did')} hint={t('ddo.didNote')}>
            <code className={mono}>{data.ddo.did}</code>
          </Row>
          <Row label={t('ddo.nft')}>
            <code className={mono}>{data.ddo.nftAddress}</code>
            <ActorBadge actor={data.actors[data.ddo.nftAddress.toLowerCase()]} compact />
          </Row>
          <Row label={t('ddo.url')}>
            <code className={mono}>{data.ddo.decryptorUrl ?? '—'}</code>
          </Row>
          <div
            className={`mt-4 rounded border p-3 text-sm ${
              data.ddo.status === 'ok'
                ? 'border-green-600/30 bg-green-50/60 dark:bg-green-950/20'
                : 'border-amber-600/40 bg-amber-50/60 dark:bg-amber-950/20'
            }`}
          >
            {t(data.ddo.reasonKey)}
          </div>
          {data.ddo.ddo != null && (
            <>
              <pre className="mt-4 max-h-96 overflow-auto rounded bg-black/5 p-3 text-xs dark:bg-white/10">
                {JSON.stringify(data.ddo.ddo, null, 2)}
              </pre>
              <p className="mt-2 text-xs text-black/55 dark:text-white/55">{t('ddo.files')}</p>
            </>
          )}
        </Card>
      )}

      {data.calldata.args.length > 0 && (
        <Card title={t('calldata.title')}>
          <p className="mb-4 text-sm text-black/70 dark:text-white/70">{t('calldata.lead')}</p>
          <Row label={t('calldata.fn')}>
            <code className="font-mono text-xs">{data.calldata.functionName}</code>
          </Row>
          {data.calldata.args.map((a) => (
            <Row key={a.name} label={a.name}>
              {a.isBlob ? (
                <span className="text-xs">
                  <code className="font-mono">{a.value.slice(0, 42)}…</code>{' '}
                  <span className="text-amber-700 dark:text-amber-400">
                    {t('logs.blob', { bytes: (a.byteLength ?? 0).toLocaleString() })}
                  </span>
                </span>
              ) : (
                <>
                  <code className={mono}>{a.value}</code>
                  {/^0x[0-9a-fA-F]{40}$/.test(a.value) && (
                    <ActorBadge actor={data.actors[a.value.toLowerCase()]} compact />
                  )}
                </>
              )}
            </Row>
          ))}
          <p className="mt-4 text-sm">
            {data.calldata.hasEncrypted ? t('calldata.mixed') : t('calldata.plain')}
          </p>
        </Card>
      )}

      {data.counterfactual && (
        <Card title={t('cf.title')}>
          <p className="mb-4 text-sm text-black/70 dark:text-white/70">{t('cf.lead')}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left dark:border-white/10">
                  <th className="py-2 pr-4 font-medium">{t('cf.how')}</th>
                  <th className="py-2 pr-4 font-medium">{t('cf.rate')}</th>
                  <th className="py-2 font-medium">{t('cf.gas')}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2 pr-4">{t('cf.asLog')}</td>
                  <td className="py-2 pr-4 text-black/60 dark:text-white/60">8 gas / byte</td>
                  <td className="py-2">{n(data.counterfactual.asLogGas)}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">{t('cf.asStorage')}</td>
                  <td className="py-2 pr-4 text-black/60 dark:text-white/60">
                    20,000 gas / 32 bytes
                  </td>
                  <td className="py-2">{n(data.counterfactual.asStorageGas)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-base">
            {t('cf.conclusion', {
              bytes: n(data.counterfactual.bytes),
              ratio: data.counterfactual.ratio,
            })}
          </p>
          <p className="mt-2 text-xs text-black/50 dark:text-white/50">{t('cf.source')}</p>
        </Card>
      )}

      {data.tokenUri && (
        <Card title={t('uri.title')}>
          <Row label="tokenURI">
            <code className={mono}>
              {data.tokenUri.raw.length > 160
                ? `${data.tokenUri.raw.slice(0, 160)}…`
                : data.tokenUri.raw}
            </code>
          </Row>
          <Row label={t('uri.kind')}>
            <strong>{t(`uri.kinds.${data.tokenUri.kind}`)}</strong>
            <p className="mt-1 text-black/70 dark:text-white/70">{data.tokenUri.note}</p>
          </Row>
          {data.tokenUri.json != null && (
            <Row label={t('uri.decoded')}>
              <pre className="overflow-x-auto rounded bg-black/5 p-3 text-xs dark:bg-white/10">
                {JSON.stringify(data.tokenUri.json, null, 2)}
              </pre>
            </Row>
          )}
        </Card>
      )}

      <Card title={t('inv.title')}>
        <h3 className="mb-2 font-medium">{t('inv.readable')}</h3>
        <ul className="mb-5 space-y-1">
          {data.readable.map((r) => (
            <li key={r} className={mono}>
              {r}
            </li>
          ))}
        </ul>

        <h3 className="mb-2 font-medium">{t('inv.encrypted')}</h3>
        {data.encrypted.length ? (
          <ul className="mb-5 space-y-1">
            {data.encrypted.map((e) => (
              <li key={e.label} className="text-sm">
                <code className="font-mono">{e.label}</code> — {n(e.bytes)} {t('result.bytes')}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-5 text-sm text-black/60 dark:text-white/60">{t('inv.none')}</p>
        )}

        <h3 className="mb-2 font-medium">{t('inv.absent')}</h3>
        <p className="text-sm text-black/70 dark:text-white/70">{t('inv.absentNote')}</p>
      </Card>

      <Card title={t('logs.title')}>
        <p className="mb-4 text-sm text-black/70 dark:text-white/70">
          {t('logs.lead', { contracts: data.contracts.length })}
        </p>
        <div className="space-y-4">
          {data.logs.map((lg) => (
            <div
              key={lg.index}
              className="rounded border border-black/10 p-3 dark:border-white/10"
            >
              <div className="mb-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-xs text-black/50 dark:text-white/50">[{lg.index}]</span>
                  <span className="font-medium">{lg.name ?? t('logs.unknown')}</span>
                  <code className="font-mono text-xs text-black/50 dark:text-white/50">
                    {lg.address}
                  </code>
                </div>
                <ActorBadge actor={data.actors[lg.address.toLowerCase()]} compact />
              </div>
              {lg.args.length ? (
                <dl className="space-y-1">
                  {lg.args.map((a) => (
                    <div key={a.name} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                      <dt className="w-full shrink-0 font-mono text-xs text-black/60 sm:w-44 dark:text-white/60">
                        {a.name}
                      </dt>
                      <dd className="min-w-0 flex-1">
                        {a.isBlob ? (
                          <span className="text-xs">
                            <code className="font-mono">{a.value.slice(0, 42)}…</code>{' '}
                            <span className="text-amber-700 dark:text-amber-400">
                              {t('logs.blob', { bytes: n(a.byteLength ?? 0) })}
                            </span>
                          </span>
                        ) : (
                          <>
                            <code className={mono}>{a.value}</code>
                            {/^0x[0-9a-fA-F]{40}$/.test(a.value) && (
                              <ActorBadge actor={data.actors[a.value.toLowerCase()]} compact />
                            )}
                          </>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="font-mono text-xs text-black/50 dark:text-white/50">
                  topic0 = {lg.topic0}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
