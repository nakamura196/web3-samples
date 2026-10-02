'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  CURRENCY,
  findRoutes,
  getClient,
  orderBook,
  snapshot,
  type BookRow,
  type Route,
  type Snapshot,
} from '@/lib/ledger';
import * as g from '@/lib/scenario';
import { ActorCard } from './ActorCard';
import { OrderBook } from './OrderBook';
import { RiceNote } from './RiceNote';
import { Badge, Card, ExtLink, Mono, abbrev } from './ui';
import { explorerTx } from '@/lib/ledger';
import { CONNECT_SNIPPET, codeFor, contextFrom, noteFor } from '@/lib/codegen';
import { GeneratedCode } from './GeneratedCode';
import { AutoTerms, KeyTerms } from './Term';
import { usePrefersReducedMotion } from './hooks';

type StepId = 'wallets' | 'issuer' | 'trust' | 'issue' | 'offer' | 'settle';
type Status = 'idle' | 'running' | 'done' | 'error';

interface StepDef {
  id: StepId;
  n: string;
  title: string;
  historical: string;
  why: string;
  /** その節の主題になる語。本文の直後に定義ごと置く */
  keyTerms: string[];
}

const STEPS: StepDef[] = [
  {
    id: 'wallets',
    n: '①',
    title: '鍵をつくり、口座を開く',
    historical: '蔵元・藩・米仲買の三者がそろう',
    why:
      'XRPL の口座は 1 XRP の base reserve が入って初めて存在する。台帳をゴミ箱にしないための家賃で、' +
      '2024年12月の validator の手数料投票で 10 XRP から 1 XRP に下がった。鍵はこのブラウザの中だけで生成され、外に出ない。',
    keyTerms: ['reserve', 'faucet'],
  },
  {
    id: 'issuer',
    n: '②',
    title: '蔵元を発行体として設定する',
    historical: '「この蔵屋敷の切手を出す」立場になる',
    why:
      'DefaultRipple を立てないと、発行体を経由した保有者どうしの直接送金が tecPATH_DRY で落ちる。' +
      'ところが板の約定は rippling を通らないので成功してしまう。つまりこのデモは ② を飛ばしても ⑥ まで完走する。' +
      '壊れるのは、保有者どうしが送金しようとした本番の場面 — 気づくのが最も遅れる種類の設定漏れである。',
    keyTerms: ['defaultripple', 'rippling'],
  },
  {
    id: 'trust',
    n: '③',
    title: '信用線を引く (TrustSet)',
    historical: '「この蔵屋敷の切手なら受け取る」と決める',
    why:
      '同意なくして残高なし。trust line が無い口座に IOU は届かない。limit は「この蔵屋敷のリスクを' +
      'いくらまで引き受けるか」の自己申告で、与信管理がアプリ層ではなくプロトコル層にある。',
    keyTerms: ['trustline', 'counterparty-risk'],
  },
  {
    id: 'issue',
    n: '④',
    title: '米切手を発行する (Payment)',
    historical: '蔵元が印判を押して、藩に切手を渡す',
    why:
      '発行体から送られた IOU は、その瞬間に発行体の負債として台帳に載る。' +
      '「A 藩の蔵屋敷の 100 石」と「B 藩の蔵屋敷の 100 石」は別の資産で、発行体は資産の一部である。',
    keyTerms: ['iou', 'issuer'],
  },
  {
    id: 'offer',
    n: '⑤',
    title: '切手を板に出す (OfferCreate)',
    historical: '堂島の米会所に売り注文を出す',
    why:
      'コントラクトのデプロイも gas 見積もりも監査予算も要らない。オーダーブックは 2012 年から' +
      'プロトコルの一次機能で、rippled に直接問い合わせれば板が見える。',
    keyTerms: ['offercreate', 'takergets'],
  },
  {
    id: 'settle',
    n: '⑥',
    title: '米仲買が買い取る',
    historical: '米と引き換える権利が、別の手に渡る',
    why:
      '反対側の注文がその場で交差して約定する。「XRP を渡す」と「切手を受け取る」は同一の' +
      'トランザクションで、片方だけ起きることはない。板を全部は食わないので、残り 15 石は板に残る。',
    keyTerms: ['fill', 'dex'],
  },
];

const ROLES = ['kuramoto', 'han', 'nakagai'] as const;

export function DemoApp() {
  const [actors, setActors] = useState<g.Actors | null>(null);
  const [status, setStatus] = useState<Record<StepId, Status>>({
    wallets: 'idle',
    issuer: 'idle',
    trust: 'idle',
    issue: 'idle',
    offer: 'idle',
    settle: 'idle',
  });
  const [errors, setErrors] = useState<Partial<Record<StepId, string>>>({});
  const [receipts, setReceipts] = useState<g.Receipt[]>([]);
  const [snaps, setSnaps] = useState<Record<string, Snapshot>>({});
  const [book, setBook] = useState<BookRow[] | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [routes, setRoutes] = useState<Route[] | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [generated, setGenerated] = useState<Set<StepId>>(new Set());
  const [showConnect, setShowConnect] = useState(false);
  const actorsRef = useRef<g.Actors | null>(null);
  const animate = !usePrefersReducedMotion();

  /**
   * コードに差し込む値。① を実行すると本物のアドレスに入れ替わり、
   * 表示中のコードもその場で組み立て直される。
   */
  const codeCtx = useMemo(() => contextFrom(actors), [actors]);

  const toggleGen = useCallback((id: StepId) => {
    setGenerated((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addLog = useCallback((m: string) => {
    setLog((prev) => [...prev, m]);
  }, []);

  const refresh = useCallback(async (a: g.Actors) => {
    const client = await getClient();
    const entries = await Promise.all(
      ROLES.map(async (r) => [a[r].wallet.address, await snapshot(client, a[r].wallet.address)] as const),
    );
    setSnaps(Object.fromEntries(entries));
    setBook(await orderBook(client, a.kuramoto.wallet.address));
  }, []);

  const runStep = useCallback(
    async (id: StepId): Promise<boolean> => {
      setStatus((s) => ({ ...s, [id]: 'running' }));
      setErrors((e) => ({ ...e, [id]: undefined }));
      try {
        const client = await getClient();

        if (id === 'wallets') {
          const a = await g.createActors(client, addLog);
          actorsRef.current = a;
          setActors(a);
          await refresh(a);
        } else {
          const a = actorsRef.current;
          if (!a) throw new Error('先に ① を実行すること');
          const got =
            id === 'issuer'
              ? [await g.enableIssuance(client, a)]
              : id === 'trust'
                ? await g.openTrustLines(client, a)
                : id === 'issue'
                  ? [await g.issueNote(client, a)]
                  : id === 'offer'
                    ? [await g.listOnDex(client, a)]
                    : [await g.takeOffer(client, a)];
          setReceipts((prev) => [...prev, ...got]);
          setRoutes(null);
          for (const r of got) addLog(`${r.type} ${r.result} · ledger #${r.ledgerIndex}`);
          await refresh(a);
        }

        setStatus((s) => ({ ...s, [id]: 'done' }));
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setErrors((prev) => ({ ...prev, [id]: msg }));
        setStatus((s) => ({ ...s, [id]: 'error' }));
        addLog(`エラー: ${msg}`);
        return false;
      }
    },
    [addLog, refresh],
  );

  const runOne = useCallback(
    async (id: StepId) => {
      setBusy(true);
      await runStep(id);
      setBusy(false);
    },
    [runStep],
  );

  const runAll = useCallback(async () => {
    setBusy(true);
    for (const s of STEPS) {
      if (status[s.id] === 'done') continue;
      const ok = await runStep(s.id);
      if (!ok) break;
    }
    setBusy(false);
  }, [runStep, status]);

  const reset = useCallback(() => {
    actorsRef.current = null;
    setActors(null);
    setReceipts([]);
    setSnaps({});
    setBook(null);
    setLog([]);
    setErrors({});
    setRoutes(null);
    setGenerated(new Set());
    setStatus({
      wallets: 'idle',
      issuer: 'idle',
      trust: 'idle',
      issue: 'idle',
      offer: 'idle',
      settle: 'idle',
    });
  }, []);

  /** ⑦ 経路探索。板の状態が変わるたびに答えが変わる。 */
  const askRoutes = useCallback(async () => {
    const a = actorsRef.current;
    if (!a) return;
    setRouteBusy(true);
    try {
      const client = await getClient();
      setRoutes(
        await findRoutes(client, a.nakagai.wallet.address, a.kuramoto.wallet.address, {
          currency: CURRENCY,
          issuer: a.kuramoto.wallet.address,
          value: '5',
        }),
      );
    } catch (e) {
      addLog(`経路探索エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRouteBusy(false);
    }
  }, [addLog]);

  const totalFee = receipts.reduce((s, r) => s + r.feeDrops, 0);
  const issueReceipt = receipts.find((r) => r.stepId === 'issue');
  const canRun = (i: number) =>
    !busy && (i === 0 || status[STEPS[i - 1].id] === 'done') && status[STEPS[i].id] !== 'done';

  return (
    <div className="space-y-6">
      <Card
        title="シナリオを走らせる"
        hint="すべて XRPL Testnet 上の本物のトランザクション。所要時間はおよそ 60 秒。"
        right={
          <div className="flex gap-2">
            <button
              onClick={runAll}
              disabled={busy || status.settle === 'done'}
              className="rounded border border-accent bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent disabled:opacity-40"
            >
              {busy ? '実行中…' : '① から順に実行'}
            </button>
            <button
              onClick={reset}
              disabled={busy}
              className="rounded border border-border px-3 py-1.5 text-xs text-ink-soft disabled:opacity-40"
            >
              リセット
            </button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {ROLES.map((role) =>
            actors ? (
              <ActorCard
                key={role}
                actor={actors[role]}
                snap={snaps[actors[role].wallet.address]}
              />
            ) : (
              <div
                key={role}
                className="rounded-lg border border-dashed border-border p-4 text-xs text-ink-soft"
              >
                {role === 'kuramoto'
                  ? '蔵元 (発行体) — 未作成'
                  : role === 'han'
                    ? '藩 (預けた側) — 未作成'
                    : '米仲買 (買い手) — 未作成'}
              </div>
            ),
          )}
        </div>

        {receipts.length > 0 && (
          <p className="mt-3 text-xs text-ink-soft">
            ここまで {receipts.length} 件のトランザクション。手数料の合計は{' '}
            <Mono>{totalFee} drops = {(totalFee / 1_000_000).toFixed(6)} XRP</Mono>{' '}
            (1 円にも満たない)。
          </p>
        )}

        <div className="mt-4 border-t border-border pt-3">
          <button
            onClick={() => setShowConnect(!showConnect)}
            className="text-[11px] text-ink-soft underline underline-offset-2 hover:text-accent"
          >
            {showConnect ? '接続コードを隠す' : '台帳につなぐコードを見る (3 行)'}
          </button>
          {showConnect && (
            <GeneratedCode code={CONNECT_SNIPPET} animate={animate} />
          )}
        </div>
      </Card>

      <div className="space-y-3">
        {STEPS.map((step, i) => {
          const st = status[step.id];
          const mine = receipts.filter((r) => r.stepId === step.id);
          return (
            <div
              key={step.id}
              className={`rounded-lg border bg-surface p-4 sm:p-5 ${
                st === 'done'
                  ? 'border-ok/40'
                  : st === 'error'
                    ? 'border-err/50'
                    : st === 'running'
                      ? 'border-accent/50'
                      : 'border-border'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">
                    <span className="mr-2 text-accent">{step.n}</span>
                    {step.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-ink-soft">{step.historical}</p>
                </div>
                <div className="flex items-center gap-2">
                  {st === 'done' && <Badge tone="ok">完了</Badge>}
                  {st === 'running' && <Badge tone="accent">実行中</Badge>}
                  {st === 'error' && <Badge tone="err">失敗</Badge>}
                  <button
                    onClick={() => toggleGen(step.id)}
                    className="rounded border border-border px-2.5 py-1 text-xs text-ink-soft hover:border-accent hover:text-accent"
                  >
                    {generated.has(step.id) ? 'コードを隠す' : 'コードを生成'}
                  </button>
                  <button
                    onClick={() => runOne(step.id)}
                    disabled={!canRun(i)}
                    className="rounded border border-border px-2.5 py-1 text-xs disabled:opacity-30"
                  >
                    実行
                  </button>
                </div>
              </div>

              <p className="mt-3 text-xs leading-relaxed">
                <AutoTerms skip={step.keyTerms}>{step.why}</AutoTerms>
              </p>
              <KeyTerms ids={step.keyTerms} />

              {generated.has(step.id) && (
                <GeneratedCode
                  key={codeCtx.live ? 'live' : 'placeholder'}
                  code={codeFor(step.id, codeCtx)}
                  note={noteFor(step.id, codeCtx)}
                  animate={animate}
                />
              )}

              {errors[step.id] && (
                <p className="mt-3 rounded border border-err/40 bg-surface-2 p-2 font-mono text-[11px] text-err">
                  {errors[step.id]}
                </p>
              )}

              {mine.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs">
                  {mine.map((r) => (
                    <li key={r.hash} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Badge tone="ok">{r.result}</Badge>
                      <span className="text-ink-soft">ledger #{r.ledgerIndex.toLocaleString()}</span>
                      <ExtLink href={explorerTx(r.hash)}>
                        <Mono>{abbrev(r.hash, 8)}</Mono>
                      </ExtLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="ネイティブ DEX の板"
          hint={`${CURRENCY} / XRP · book_offers をそのまま表示している`}
        >
          <OrderBook rows={book} />

          <div className="mt-4 border-t border-border pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold">レジャーに経路を聞く</h3>
                <p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">
                  「米仲買から蔵元へ 5 石ぶんを届けるには何を出せばよいか」を
                  <span className="font-mono"> ripple_path_find </span>に問い合わせる。
                </p>
              </div>
              <button
                onClick={askRoutes}
                disabled={!actors || routeBusy || busy}
                className="rounded border border-border px-2.5 py-1 text-xs disabled:opacity-30"
              >
                {routeBusy ? '探索中…' : '経路を探索'}
              </button>
            </div>

            {routes && (
              <ul className="mt-3 space-y-1.5 text-xs">
                {routes.length === 0 && <li className="text-ink-soft">経路が見つからない。</li>}
                {routes.map((r, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="accent">{r.sourceAmount} を出す</Badge>
                    <span className="text-ink-soft">
                      {r.hops.length === 0 ? '直接 (信用線をそのまま伝う)' : `経由: ${r.hops.join(' → ')}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card title="実行ログ" hint="ブラウザから testnet へ直接投げている">
          {log.length === 0 ? (
            <p className="text-xs text-ink-soft">まだ何も実行していない。</p>
          ) : (
            <ol className="scroll-x max-h-64 space-y-1 overflow-y-auto font-mono text-[11px] leading-relaxed">
              {log.map((l, i) => (
                <li key={i} className="text-ink-soft">
                  {String(i + 1).padStart(2, '0')} {l}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {issueReceipt && (
        <Card title="発行された受領証" hint="1900 年前のパピルスと、同じ項目がそろっている">
          <RiceNote receipt={issueReceipt} />
        </Card>
      )}
    </div>
  );
}
