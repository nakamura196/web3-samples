import Link from 'next/link';
import type { Metadata } from 'next';
import { Lead, Note, P, Section, Table } from '@/components/learn';
import { ExtLink } from '@/components/ui';

export const metadata: Metadata = {
  title: 'どの国が進んでいるのか — カナダ・韓国・日本',
  description:
    'ブロックチェーンで「進んでいる」国はどこか。制度・ETF・普及・決済インフラという軸に分けて、カナダ・韓国・日本を比較する。',
};

export default function World() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink-soft">
          Granary · 国際比較
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          どの国が進んでいるのか
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-8 text-ink-soft">
          「カナダや韓国が進んでいる」とよく言われる。半分は当たっていて、半分は外れている。
          「進んでいる」の中身が国ごとに違うので、軸に分けて見る。
          そして、日本は思われているほど遅れていない。
        </p>
        <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs">
          <Link href="/basics" className="text-accent underline underline-offset-2">
            ← はじめから
          </Link>
          <a href="#s1" className="text-ink-soft underline underline-offset-2">1. 軸ごとの比較</a>
          <a href="#s2" className="text-ink-soft underline underline-offset-2">2. カナダ</a>
          <a href="#s3" className="text-ink-soft underline underline-offset-2">3. 韓国</a>
          <a href="#s4" className="text-ink-soft underline underline-offset-2">4. 日本</a>
          <a href="#s5" className="text-ink-soft underline underline-offset-2">5. 測り方を疑う</a>
        </nav>
      </header>

      <div className="mt-10 space-y-12">
        <Section n="0" title="先に結論" lead="3 行でまとめる。">
          <ul className="max-w-2xl space-y-3 text-sm leading-8">
            <li>
              <strong>カナダ</strong> — ETF と規制の先行は本物。ただし
              <strong>決済インフラは明確に遅れている</strong>。
            </li>
            <li>
              <strong>韓国</strong> — 個人の熱量は世界屈指。ただし制度は「保護」寄りで、
              <strong>機関向けはむしろ遅れている</strong>。
            </li>
            <li>
              <strong>日本</strong> — 遅れていない。
              <strong>ステーブルコインの実装はむしろ世界最速級</strong>で、
              2026 年の法改正で税制の足枷も外れる方向にある。
            </li>
          </ul>
        </Section>

        {/* 1 */}
        <Section
          n="1"
          title="軸ごとに見る"
          lead="1 本の物差しで順位はつかない。何を数えるかで結論が変わる。"
        >
          <Table
            head={['', 'カナダ', '韓国', '日本']}
            firstColWidth="9rem"
            rows={[
              [
                '現物 ETF',
                <>
                  <strong>世界初</strong>（2021 年 2 月）。米国より約 3 年早い
                </>,
                <>
                  <strong>未解禁</strong>。2026 年の経済成長戦略で方針は出たが、資本市場法の改正待ち
                </>,
                '2026 年 7 月の法改正で整備が進む',
              ],
              [
                'ステーブルコイン法',
                'Bill C-15 が 2026-03-26 成立。ただし施行は 2027 年見込み',
                <>
                  <strong>停滞中</strong>。中央銀行と金融当局が合意できていない
                </>,
                <>
                  2023 年に枠組み。円建ての実装が既に稼働 = <strong>最も早い</strong>
                </>,
              ],
              ['法人・機関の参加', '早くから可能', '9 年間の禁止がようやく解除', '可能'],
              [
                '個人の普及',
                '4 人に 1 人が保有（講演資料）',
                <>
                  <strong>人口比で世界屈指</strong>の取引量
                </>,
                '中程度',
              ],
              [
                '決済インフラ',
                <>
                  <strong>遅れている</strong>。即時決済が 10 年遅延
                </>,
                '既存の即時送金が非常に速い',
                '全銀システムで足りている',
              ],
              [
                '自国発の基盤',
                'Ethereum の Vitalik Buterin はトロント育ち',
                'Kaia（Klaytn と Finschia が 2024 年に統合）',
                '—',
              ],
            ]}
          />
          <Note label="表の読み方">
            上 2 行は「制度が整っているか」、真ん中 2 行は「実際に使われているか」、
            下 2 行は「基盤があるか」を見ている。
            この 3 つは連動しない。制度が整っていても使われていない国もあれば、
            制度が未整備でも取引量だけ多い国もある。
          </Note>
        </Section>

        {/* 2 */}
        <Section
          n="2"
          title="カナダ — 先行しているが、足元が弱い"
          lead="いただいた講演資料は XRPL Canada の作成だが、自国にかなり批判的である。そこが信頼できる。"
        >
          <P>
            <strong>先行している点。</strong>
            現物ビットコイン ETF を世界で最初に承認したのはカナダで、2021 年 2 月のことだった。
            米国が追随したのは 2024 年 1 月なので、約 3 年早い。
            講演資料によれば、上場している暗号資産 ETF は 76 本、残高は 56 億ドル。
            国民の 4 人に 1 人が何らかの暗号資産を保有しているという。
          </P>
          <P>
            制度も動いている。2026 年 3 月 26 日に Bill C-15 が成立し、
            連邦レベルのステーブルコイン法ができた。
            発行体はカナダ銀行に登録し、1 対 1 の高品質流動資産を、
            破産時に隔離される形で適格カストディアンに預けることが求められる。
            ただし<strong>実際に効力を持つのは 2027 年の見込み</strong>で、いまは規則の整備待ちである。
          </P>
          <P>
            2026 年 2 月には CIRO（カナダの自主規制機関）がデジタル資産の
            カストディ枠組みを出し、ウォレットの分別管理やガバナンス、
            サイバーセキュリティの要件を定めた。
          </P>

          <Lead>問題は、ここから先である。</Lead>
          <P>
            <strong>第一に、決済インフラが遅れている。</strong>
            カナダは 2016 年に Real-Time Rail という即時送金システムを発表した。
            当初の稼働目標は過ぎ、リスクの再検証のために一度止まり、
            2026 年になってもまだ動いていない。
            講演資料の指摘によれば、その間に
            <strong>79 か国が既に何らかの即時決済システムを稼働させている</strong>。
            皮肉な話で、この遅れこそが「台帳なら 3〜5 秒で終わる」という主張に
            説得力を与えてしまっている。
          </P>
          <P>
            <strong>第二に、カストディ規制が外国依存を生みかねない。</strong>
            CIRO の枠組みは、顧客資産を預かる第一階層の要件として、
            カナダ籍の事業者に 1 億ドル、外国事業者に 1 億 5,000 万ドルの資本を求める。
            カナダ資本の会社がこの水準に届かなければ、
            <strong>国内の資産が少数の外国カストディアンに集中する</strong>。
            CIRO 自身が集中リスクを指摘している。
            規制が厳しいことと、システムが強靭であることは別だ、という教材のような例である。
          </P>
          <Note label="ここは面白い">
            「規制が進んでいる国」を目指した結果、
            <strong>自国の資産を国外に預ける構造ができあがる</strong>かもしれない。
            講演の副題が「Building Trust Infrastructure（信頼の基盤をつくる）」であることを思うと、
            この指摘は自己批判として重い。
          </Note>
        </Section>

        {/* 3 */}
        <Section
          n="3"
          title="韓国 — 熱量は世界一、制度は保護寄り"
          lead="止まっている理由が、技術ではなく権力配分にあるのが特徴的である。"
        >
          <P>
            個人の取引の活発さでは、韓国は世界でも突出している。
            人口比で見た取引量、取引所の規模、値動きへの関心の高さ、どれをとっても異例である。
            そういう意味では、たしかに「進んでいる」。
          </P>
          <P>
            ところが制度は、一貫して<strong>投資家保護に寄っている</strong>。
            法人が暗号資産を取引することは 9 年にわたって事実上禁じられており、
            それがようやく解除されたところである。
            現物 ETF はいまも解禁されていない。
            2026 年の経済成長戦略で解禁の方針が明示されたが、
            資本市場法の改正が必要で、まだ実現していない。
            日本・カナダ・米国と比べると、この点は明確に遅れている。
          </P>

          <Lead>そして、包括法が止まっている理由が興味深い。</Lead>
          <P>
            韓国はデジタル資産基本法（Digital Asset Basic Act）を 2026 年後半に進める予定だが、
            <strong>金融委員会（FSC）と韓国銀行が合意できずに停滞している</strong>。
            争点はウォン建てステーブルコインを誰が発行してよいかである。
          </P>
          <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
            <div className="rounded border border-border bg-surface-2 p-3 text-xs leading-7">
              <p className="font-semibold">韓国銀行（中央銀行）</p>
              <p className="mt-1">
                発行は銀行主導のコンソーシアムに限るべきで、
                銀行が 51% 以上を保有すること。
              </p>
            </div>
            <div className="rounded border border-border bg-surface-2 p-3 text-xs leading-7">
              <p className="font-semibold">金融委員会（FSC）</p>
              <p className="mt-1">
                それではテック企業が締め出され、イノベーションが遅れる。
              </p>
            </div>
          </div>
          <P>
            つまり韓国が詰まっているのは技術的な難しさではなく、
            <strong>「誰が発行者になれるか」という権力の配分</strong>である。
            この構図は、どの国でもいずれ通る道になる。
          </P>
          <P>
            背景も見ておく価値がある。2022 年に崩壊した Terra / Luna は韓国発だった。
            制度が保護寄りに傾いた理由の一端はここにある。
            また、ブロックチェーンを使ったゲーム（Play to Earn）は
            <strong>国内では禁止されたまま</strong>で、
            韓国企業が海外では大手として展開している、というねじれもある。
          </P>
        </Section>

        {/* 4 */}
        <Section
          n="4"
          title="日本 — 実は遅れていない"
          lead="「日本は規制が厳しくて遅れている」という言い方は、2026 年にはもう当たらない。"
        >
          <P>
            日本は 2017 年の時点で、資金決済法に暗号資産交換業の登録制度を入れていた。
            これは Mt.Gox の破綻を受けた対応で、世界的にかなり早い。
            早すぎたために、後から出てきた形態に法律が追いつかない、という副作用も生んだ。
          </P>
          <P>
            ステーブルコインについては、2023 年に電子決済手段という枠組みができ、
            円建てのステーブルコインが実際に発行・流通している。
            <strong>カナダの Stablecoin Act より 3 年早く、実装まで進んでいる</strong>。
            この点で日本は世界最速級である。
          </P>
          <P>
            そして 2026 年に大きな改正があった。
            2026 年 7 月 15 日に金融商品取引法の改正が成立し、
            暗号資産の規制の中心が資金決済法から金商法へ移る。
            インサイダー取引規制が導入され、ETF 解禁に向けた整備が入り、
            課税を総合課税（最大 55%）から申告分離課税 20% へ移す道筋がついた。
            施行は 2027 年、分離課税の適用は 2028 年の見込みとされる。
          </P>
          <Note label="日本の弱点は、技術ではなく税だった">
            日本で人が動かなかった最大の理由は、規制の厳しさよりも
            <strong>税制</strong>だった、という見方がある。
            利益が雑所得で総合課税だと、事業としても個人としても割に合わない。
            2026 年の改正はそこを直しに来た。効果が出るのは 2028 年以降になる。
          </Note>
        </Section>

        {/* 5 */}
        <Section
          n="5"
          title="測り方そのものを疑う"
          lead="ここまで「制度が整っているか」で比べてきたが、それは本当に「進んでいる」ことだろうか。"
        >
          <Lead>
            実際に日常で使われている度合いで測ると、順位はまるで変わる。
          </Lead>
          <P>
            送金や決済でブロックチェーンが本当に使われているのは、
            フィリピン、ナイジェリア、アルゼンチンといった国々である。
            共通しているのは、<strong>インフレが激しいか、送金コストが高いか、
            そもそも銀行口座を持てない人が多い</strong>ことだ。
          </P>
          <P>
            技術が広まるのは「便利だから」ではなく、
            <strong>いまのやり方が壊れているから</strong>である。
            先進国が言う「進んでいる」は、ほとんどが制度整備の話であって、
            切実さの話ではない。
          </P>

          <Lead>これは、日本で何かを設計するときに直接効いてくる。</Lead>
          <P>
            日本の全銀システムは動いている。振込は速いし、確実だし、信頼されている。
            だから<strong>「速い・安い」を理由に台帳を持ち出しても、日本では通らない</strong>。
            比較対象が既に十分よいからである。
          </P>
          <P>
            日本で台帳が意味を持つのは、
            <Link href="/learn" className="mx-1 text-accent underline underline-offset-2">
              解説ページ
            </Link>
            に書いたとおり、「記録を一人で持っている人を信用しなくて済ませたい」ときだけである。
            資料の来歴、査読の実績、アーカイブの改ざん検知——
            <strong>いずれも速度とは無関係の理由</strong>で台帳が効く領域だ。
            提案を書くときは、ここを取り違えないほうがよい。
          </P>
          <div className="max-w-2xl rounded-lg border border-accent/40 bg-accent-soft p-4 text-sm leading-8">
            結論として、「カナダや韓国が進んでいるから日本も追いつくべき」という
            立て方はあまり生産的ではない。
            それぞれの国が、それぞれの弱点を埋めようとしているだけである。
            日本で考えるべきは「日本の何が壊れているか」で、
            決済はそこに入らない。
          </div>
        </Section>

        {/* 出典 */}
        <section className="border-t border-border pt-10">
          <h2 className="text-lg font-bold">出典と注意</h2>
          <p className="mt-3 max-w-2xl text-xs leading-7 text-ink-soft">
            このページの記述は、2026 年 8 月時点で確認できた情報に基づく。
            制度はどれも進行中なので、実際に引用する場合は一次情報を確認すること。
            カナダについての指摘の一部は、講演資料
            <em> Building Trust Infrastructure — From Roman Grain to XRPL</em>
            （UBC Blockchain Summer Institute, 2026-08-21 · Mayowa Rosanwo / XRPL Canada）による。
            日本についての 2026 年の改正は、
            <span className="font-mono text-[11px]"> si2026/docs/japan-web3-2026.md </span>
            にまとめられている内容に基づく。
          </p>
          <ul className="mt-4 max-w-2xl space-y-2 text-xs leading-7">
            <li>
              ·{' '}
              <ExtLink href="https://www.lexology.com/library/detail.aspx?g=a5ff681d-f34a-46d2-b36b-513361be5a63">
                Canada enacts framework to regulate stablecoin in Bill C-15 (Lexology)
              </ExtLink>
            </li>
            <li>
              ·{' '}
              <ExtLink href="https://practiceguides.chambers.com/practice-guides/blockchain-crypto-assets-2026/canada">
                Blockchain &amp; Crypto-Assets 2026 — Canada (Chambers and Partners)
              </ExtLink>
            </li>
            <li>
              ·{' '}
              <ExtLink href="https://cryptobriefing.com/south-korea-digital-asset-basic-act-crypto/">
                South Korea plans Digital Asset Basic Act (Crypto Briefing)
              </ExtLink>
            </li>
            <li>
              ·{' '}
              <ExtLink href="https://finance.yahoo.com/news/south-korea-plans-crypto-etfs-125503934.html">
                South Korea Plans Crypto ETFs in 2026 (Yahoo Finance)
              </ExtLink>
            </li>
            <li>
              ·{' '}
              <ExtLink href="https://www.coinreporter.io/2026/05/south-koreas-digital-asset-basic-act-stablecoin-rules-and-corporate-investment-greenlight-for-2026/">
                South Korea&apos;s Digital Asset Basic Act (CoinReporter)
              </ExtLink>
            </li>
          </ul>
        </section>
      </div>

      <footer className="mt-12 border-t border-border pt-6 text-xs leading-7 text-ink-soft">
        <p className="flex flex-wrap gap-x-4">
          <Link href="/basics" className="text-accent underline underline-offset-2">
            ← はじめから
          </Link>
          <Link href="/" className="text-accent underline underline-offset-2">
            ← デモ
          </Link>
          <Link href="/apply" className="text-accent underline underline-offset-2">
            何を、どの台帳で →
          </Link>
        </p>
      </footer>
    </main>
  );
}
