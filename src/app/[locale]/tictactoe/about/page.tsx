import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import PageLayout from '@/samples/tictactoe/components/layout/PageLayout';
import { getPageMetadata } from '@/samples/tictactoe/constants/metadata';
import { PROSE_STYLES } from '@/samples/tictactoe/constants/styles';
import { routing } from '@/samples/tictactoe/nav';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const activeLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: activeLocale, namespace: 'tictactoe.About' });
  return getPageMetadata(activeLocale, { title: t('title'), description: t('description') });
}

/**
 * Explains the contract in prose. Kept as inline markup rather than a Markdown
 * pipeline: it is two pages of copy that changes when the contract changes, so
 * it lives next to the code it describes.
 */
const CONTENT: Record<'ja' | 'en', string> = {
  ja: `
    <h2>全体像</h2>
    <p>このアプリは 2 つのスマートコントラクトでできています。互いに呼び出しあうことはなく、それぞれ独立してデプロイされています。</p>
    <ul>
      <li><strong>TicTacToe</strong> — 人間同士の対戦。両者の賭け金を預かります</li>
      <li><strong>SoloTicTacToe</strong> — コントラクトを相手にした練習。賭け金はありません</li>
    </ul>
    <p>サーバもデータベースもありません。盤面も勝敗判定もチェーン上にあり、この Web ページは単にそれを読み書きしているだけです。</p>

    <h2>お金の流れ</h2>
    <ol>
      <li>ゲームを作った人が賭け金を送金します。コントラクトが預かります</li>
      <li>参加者が同額を送金します。ポットは賭け金の 2 倍になります</li>
      <li>決着すると、勝者の受取額がコントラクト内に<strong>記帳</strong>されます</li>
      <li>勝者が「引き出す」を実行して初めて送金されます</li>
    </ol>
    <p>4 段階目が分かれているのは意図的です。決着と同時に自動送金する設計だと、受取側が送金を拒否するコントラクトだった場合に決着処理そのものが失敗し、相手のお金まで永久に取り出せなくなります。記帳と送金を分ければ、受け取れない人がいても他の人は影響を受けません。</p>

    <h2>引き分けと放置</h2>
    <p>盤面が埋まって引き分けになった場合、手数料は取らずに両者へ賭け金を返します。</p>
    <p>相手が手を指さずに消えた場合は、持ち時間が切れた時点で<strong>不戦勝</strong>を主張できます。ポットは待っていた側のものになります。この仕組みがないと、負けそうな側が黙って立ち去るだけで両者の資金が永久に凍結します。</p>

    <h2>CPU 対戦について</h2>
    <p>まるばつは解けているゲームで、双方が最善を打つと必ず引き分けになります。したがって完璧な CPU に賭けを挑んでも、最良の結果が「引き分け＝返金」にしかなりません。だから CPU 戦は賭けなしにしてあります。</p>
    <p>強さは 3 段階です。「中」は勝ちと詰みしか見ないので、二重の狙い（フォーク）を作れば人間が勝てます。「強」は定石を完全に実装しており、全探索によるテストで負けないことを検証済みです。</p>

    <h2>テストネット専用です</h2>
    <p>このアプリはメインネットに接続しません。ウォレットの接続先一覧にもメインネットを入れていないので、本物の ETH が賭けられることはありません。</p>
  `,
  en: `
    <h2>The shape of it</h2>
    <p>Two smart contracts, deployed independently. They never call each other.</p>
    <ul>
      <li><strong>TicTacToe</strong> — player versus player. Holds both stakes in escrow.</li>
      <li><strong>SoloTicTacToe</strong> — practice against the contract. No stakes.</li>
    </ul>
    <p>There is no server and no database. The board and the win check live on chain; this page only reads and writes them.</p>

    <h2>How the money moves</h2>
    <ol>
      <li>The creator sends a stake. The contract holds it.</li>
      <li>An opponent matches it. The pot is now twice the stake.</li>
      <li>When the game is decided, the payout is <strong>credited</strong> inside the contract.</li>
      <li>Nothing is transferred until the winner calls withdraw.</li>
    </ol>
    <p>That fourth step is deliberate. If settling a game also pushed the funds out, a winner whose wallet rejects incoming transfers would make the settlement itself fail — freezing the opponent's money too. Crediting first and paying on request keeps one player's problem from becoming everyone's.</p>

    <h2>Draws and abandoned games</h2>
    <p>A full board with no line refunds both stakes and takes no fee.</p>
    <p>If an opponent simply walks away, the clock runs out and the waiting player claims the pot by <strong>forfeit</strong>. Without that, anyone facing a loss could freeze both stakes forever by doing nothing.</p>

    <h2>About the CPU games</h2>
    <p>Tic-tac-toe is a solved game: perfect play on both sides always draws. Betting against a perfect opponent can only break even at best, which is why practice games carry no stake.</p>
    <p>Three difficulties. Normal only sees wins and immediate losses, so a fork — two threats at once — beats it. Hard implements the full strategy, and an exhaustive test proves it never loses.</p>

    <h2>Testnets only</h2>
    <p>This app does not connect to mainnet. It is absent from the list of networks the wallet is offered, so real funds can never be staked here.</p>
  `,
};

export default async function About({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'tictactoe.About' });
  const content = CONTENT[locale as 'ja' | 'en'] ?? CONTENT.en;

  return (
    <PageLayout title={t('title')} description={t('description')} breadcrumbItems={[{ title: t('title') }]}>
      <article className="prose prose-lg max-w-none dark:prose-invert">
        <div dangerouslySetInnerHTML={{ __html: content }} className={PROSE_STYLES} />
      </article>
    </PageLayout>
  );
}
