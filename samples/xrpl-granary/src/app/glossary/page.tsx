import type { Metadata } from 'next';
import Link from 'next/link';
import { AskBox } from '@/components/AskBox';
import { FaqList } from '@/components/FaqList';
import { GlossaryBrowser } from '@/components/GlossaryBrowser';
import { Card } from '@/components/ui';
import { FAQ } from '@/lib/faq';
import { GLOSSARY } from '@/lib/glossary';

export const metadata: Metadata = {
  title: 'わからないとき — 用語集とよくある質問',
  description:
    'XRPL のデモに出てくる用語とよくある質問。打ち込んだ文に近い項目を探して返す。LLM を使わず、あらかじめ用意した回答から引く。',
};

export default function GlossaryPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink-soft">
          用語集 {GLOSSARY.length} 語 · 質問 {FAQ.length} 件
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">わからないとき</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          デモに出てくる語と、講義で実際に出る質問をまとめてある。
          本文中の点線が引かれた語はどこでもクリックでき、その場で意味が出る。
        </p>
        <p className="mt-3 flex flex-wrap gap-x-4 text-sm">
          <Link href="/" className="text-accent underline underline-offset-2">
            ← デモに戻る
          </Link>
          <Link href="/easy" className="text-accent underline underline-offset-2">
            専門語なしの説明 →
          </Link>
        </p>
      </header>

      <Card
        title="聞いてみる"
        hint="打ち込んだ文に近いものを、用意した回答の中から探す"
      >
        <AskBox />
        <p className="mt-4 border-t border-border pt-2.5 text-[11px] leading-relaxed text-ink-soft">
          仕組みを隠さずに書いておく。ここは <strong>LLM を呼んでいない</strong>。
          打ち込まれた文と、上の {GLOSSARY.length} 語 + {FAQ.length} 件の間で文字の重なりを測り、
          一番近いものを返しているだけである。だから答えは即座に出るし、料金もかからず、
          会場の回線が落ちても動く。内容も講師が書いたもので固定されているので、
          もっともらしい嘘が混ざることがない。代わりに、想定していない質問には答えられない。
          そのときは近くにいる人に聞くのが早い。
        </p>
      </Card>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-bold tracking-tight">よくある質問</h2>
        <FaqList />
      </section>

      <section className="mt-12">
        <h2 className="mb-4 text-lg font-bold tracking-tight">用語集</h2>
        <GlossaryBrowser />
      </section>

      <footer className="mt-12 border-t border-border pt-6 text-xs leading-relaxed text-ink-soft">
        <p>
          一次資料は <a href="https://xrpl.org/docs" target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">xrpl.org</a> と{' '}
          <a href="https://js.xrpl.org/" target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">js.xrpl.org</a>。
          記述が食い違っていたら、あちらが正しい。
        </p>
      </footer>
    </main>
  );
}
