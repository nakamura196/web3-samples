import Link from 'next/link';
import { DemoApp } from '@/components/DemoApp';
import { LedgerTicker } from '@/components/LedgerTicker';
import { Features } from '@/components/Features';
import { AskBox } from '@/components/AskBox';
import { Card, ExtLink } from '@/components/ui';

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink-soft">
          大坂 · 堂島 · 18 世紀 → XRP Ledger · 2026
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          米切手 — 蔵屋敷の預り証を XRPL に載せる
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
          江戸時代、諸藩は大坂に蔵屋敷を置き、領地から運ばせた米をそこに納めて売った。
          蔵屋敷は代金を納めた商人に「米○石と引き換える」という<strong>米切手</strong>を渡す。
          切手は米そのものではなく蔵屋敷の負債で、堂島の市場で売買された。
          裏付けの無い切手が出回れば紙切れになる、という危うさも込みで。
          同じ構造を、いま XRP Ledger の Testnet 上でブラウザだけで実行する。
        </p>
        <div className="mt-4">
          <LedgerTicker />
        </div>
        <p className="mt-4 text-sm">
          <Link
            href="/easy"
            className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent"
          >
            はじめての人はこちら — 専門語なしの説明 →
          </Link>{' '}
          <Link
            href="/learn"
            className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs font-medium text-ink-soft"
          >
            ゆっくり読む XRPL →
          </Link>{' '}
          <Link
            href="/apply"
            className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs font-medium text-ink-soft"
          >
            何を、どの台帳で — 応用の設計図 →
          </Link>{' '}
          <Link
            href="/glossary"
            className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs font-medium text-ink-soft"
          >
            わからないとき — 用語集と質問 →
          </Link>
        </p>
      </header>

      <Card title="このデモの前提" hint="読んでから実行すること">
        <ul className="space-y-1.5 text-xs leading-relaxed">
          <li>
            · 接続先は <strong>XRPL Testnet</strong> のみ。ここで生成される鍵に実資産を入れないこと。
          </li>
          <li>
            · 鍵はブラウザのメモリ上でだけ生成され、サーバには送られない。
            このアプリにバックエンドは存在せず、
            <span className="font-mono text-[11px]"> wss://s.altnet.rippletest.net:51233 </span>
            へ直接つないでいる。
          </li>
          <li>· リロードすると鍵は失われる。作った口座は Testnet 上に残るが、二度と署名できない。</li>
          <li>
            · 資金は <ExtLink href="https://xrpl.org/resources/dev-tools/xrp-faucets">Testnet faucet</ExtLink>{' '}
            から入る。連続実行すると流量制限にかかることがある。
          </li>
        </ul>
      </Card>

      <div className="mt-6">
        <DemoApp />
      </div>

      <div className="mt-8">
        <Card
          title="詰まったら"
          hint="用意した回答の中から、近いものを探して出す"
          right={
            <Link href="/glossary" className="text-xs text-accent underline underline-offset-2">
              一覧を見る →
            </Link>
          }
        >
          <AskBox />
        </Card>
      </div>

      <div className="mt-10">
        <Features />
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">読み物</h2>
        <p className="mt-2 max-w-2xl text-xs leading-7 text-ink-soft">
          難しいと感じたら、いちばん上から順に読むのがよい。前提知識は要らない。
        </p>
        <ul className="mt-3 space-y-2 text-xs leading-7">
          <li>
            ·{' '}
            <Link href="/basics" className="text-accent underline underline-offset-2">
              はじめから
            </Link>{' '}
            — ブロックチェーンを今日はじめて聞いた人向け。用語辞典つき
          </li>
          <li>
            ·{' '}
            <Link href="/learn" className="text-accent underline underline-offset-2">
              ゆっくり読む XRPL
            </Link>{' '}
            — 6 ステップの分解、普通のシステムとの違い、他のプロトコルとの違い、よくある誤解
          </li>
          <li>
            ·{' '}
            <Link href="/apply" className="text-accent underline underline-offset-2">
              何を、どの台帳で
            </Link>{' '}
            — プロトコル別の得意/不得意、アーカイブ・学術情報流通での応用、アプリ案 10 件
          </li>
          <li>
            ·{' '}
            <Link href="/world" className="text-accent underline underline-offset-2">
              どの国が進んでいるのか
            </Link>{' '}
            — カナダ・韓国・日本の比較
          </li>
        </ul>
      </div>

      <footer className="mt-12 border-t border-border pt-6 text-xs leading-relaxed text-ink-soft">
        <p>
          題材は <em>Building Trust Infrastructure — From Roman Grain to XRPL</em>{' '}
          (UBC Blockchain Summer Institute, 2026年8月21日 · Mayowa Rosanwo / XRPL Canada) の講演。
          講演はローマ期エジプトの穀物受領証を例にしていたが、ここでは日本の読み手に合わせて
          大坂・堂島の米切手に置き換えている。構造は同じである。
          実装は <ExtLink href="https://js.xrpl.org/">xrpl.js</ExtLink> と{' '}
          <ExtLink href="https://xrpl.org/docs">xrpl.org のドキュメント</ExtLink> に基づく。
        </p>
        <p className="mt-2">
          「あなたは分散型ネットワークに参加するのではない。分散型ネットワークを存在させる側に回るのだ。」
        </p>
      </footer>
    </main>
  );
}
