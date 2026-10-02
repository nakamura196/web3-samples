import Link from 'next/link';
import type { Metadata } from 'next';
import { Analogy, Chapter, Key, T, Term, WayCard, Word } from '@/components/basics';

export const metadata: Metadata = {
  title: 'はじめから — ゼロから読むブロックチェーン',
  description:
    'ブロックチェーンという言葉を今日はじめて聞いた人のための説明。専門用語は出てくるたびにその場で説明する。',
};

export default function Basics() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink-soft">入門</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">はじめから</h1>
        <p className="mt-4 text-[15px] leading-9">
          このページは、ブロックチェーンという言葉を今日はじめて聞いた人に向けて書いています。
          専門用語は、出てきたその場で説明します。
          前の章が分からないまま次に進まなくてよいように、順番に積み上げます。
          最後に用語辞典を置いてあります。
        </p>
        <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs">
          <a href="#c1" className="text-ink-soft underline underline-offset-2">1. お金は記録</a>
          <a href="#c2" className="text-ink-soft underline underline-offset-2">2. 書く人がいる</a>
          <a href="#c3" className="text-ink-soft underline underline-offset-2">3. 1 冊にしない</a>
          <a href="#c4" className="text-ink-soft underline underline-offset-2">4. 決め方の 3 種類</a>
          <a href="#c5" className="text-ink-soft underline underline-offset-2">5. デモの中身</a>
          <a href="#c6" className="text-ink-soft underline underline-offset-2">6. 何がすごいのか</a>
          <a href="#c7" className="text-ink-soft underline underline-offset-2">7. 資料の世界で</a>
          <a href="#c8" className="text-ink-soft underline underline-offset-2">8. 注意</a>
          <a href="#glossary" className="text-accent underline underline-offset-2">用語辞典</a>
        </nav>
      </header>

      <div className="mt-10 space-y-12">
        {/* 1 */}
        <Chapter n={1} title="お金は「物」ではなく「記録」です">
          <T>
            銀行口座に 10 万円ある、とします。
            銀行の金庫のどこかにあなた専用の引き出しがあって、
            そこに 1 万円札が 10 枚入っている——わけではありません。
          </T>
          <T>
            あるのは<strong>記録だけ</strong>です。
            銀行のコンピュータに「この人の残高 100,000」と書いてある。それだけです。
          </T>
          <T>
            振込も同じです。10 万円が物理的に移動するのではなく、
            「A さん 100,000 → 0」「B さん 0 → 100,000」と<strong>書き換えているだけ</strong>。
          </T>
          <Key>
            「誰がいくら持っているか」を書いた記録のことを、台帳（だいちょう）といいます。
            お小遣い帳と同じものです。規模が大きいだけです。
          </Key>
          <Word term="台帳">誰が誰にいくら払ったかを書いた記録。銀行の残高も、お小遣い帳も台帳。</Word>
        </Chapter>

        {/* 2 */}
        <Chapter n={2} title="台帳には、必ず「書く人」がいます">
          <T>
            銀行の台帳を書けるのは銀行だけです。あなたは見ることはできますが、書けません。
          </T>
          <T>
            これは普段まったく問題になりません。銀行は間違えないし、勝手に減らしたりしないからです。
            問題になるのは、次の 3 つのときだけです。
          </T>
          <ol className="max-w-2xl space-y-2 text-[15px] leading-9">
            <li>1. 書く人が<strong>潰れた</strong>とき</li>
            <li>2. 書く人が<strong>間違えた</strong>とき</li>
            <li>3. 書く人が「あなたとは取引しません」と<strong>決めた</strong>とき</li>
          </ol>
          <Analogy>
            学校の出席簿を思い浮かべてください。
            先生が「欠席」と書いたら、あなたが「行きました」と言っても覆せません。
            先生を信用できるあいだは、それで何も困らない。
            信用できなくなった瞬間に、打つ手がなくなる。
          </Analogy>
          <Key>
            ブロックチェーンは、この 3 つの場合にだけ効く道具です。
            それ以外の場面では、普通の仕組みのほうが速くて安くて便利です。
          </Key>
          <T>
            この一文が、このサイト全体でいちばん大事なところです。
            「新しくてすごい技術」ではなく、
            <strong>「記録を持っている人を信用できないときの、最後の手段」</strong>だと思ってください。
          </T>
        </Chapter>

        {/* 3 */}
        <Chapter n={3} title="台帳を 1 冊にしなければいい">
          <T>
            1 冊しかないから、その 1 冊を持っている人が強くなります。
          </T>
          <T>
            では、まったく同じ内容の台帳を 1 万冊つくって、
            世界中の 1 万人が 1 冊ずつ持ったらどうなるでしょうか。
            1 人がこっそり自分の残高を書き換えても、
            残り 9,999 冊と食い違うので、すぐに分かります。
          </T>
          <Key>
            これがブロックチェーンの基本的な発想です。ここまでに難しい理屈は何もありません。
          </Key>
          <T>
            難しいのは、次の一点だけです。
          </T>
          <div className="max-w-2xl rounded-lg border border-border bg-surface p-4 text-[15px] leading-9">
            新しい取引を書き足すとき、その 1 万人はどうやって
            <strong>「これが正しい」と決めるのか？</strong>
          </div>
          <T>
            世界中の、お互いを知らない人たちです。会議は開けません。
            多数決をしようにも、1 人が 1 万人分になりすませたら意味がありません。
            この「決め方」をどう設計するかで、ブロックチェーンの種類が分かれます。
          </T>
          <Word term="ブロックチェーン">
            同じ台帳のコピーを大勢が持ち、書き足すときだけ全員で確認する仕組み。
            「ブロック（記録のかたまり）」を「チェーン（鎖）」のようにつないでいくので、この名前がついた。
          </Word>
        </Chapter>

        {/* 4 */}
        <Chapter n={4} title="「決め方」は、大きく 3 種類あります">
          <T>
            ここが、Bitcoin・Ethereum・XRPL の違いの正体です。
            それぞれ違う答えを出しています。
          </T>
          <div className="space-y-4">
            <WayCard
              name="Bitcoin — 一番働いた人が書く"
              rule="とても難しい計算問題を出して、最初に解いた人が次のページを書ける、というルールです。計算にはコンピュータの電気代がかかります。ズルをするには世界中の計算力の半分以上を自分で用意する必要があり、天文学的な費用になるので、誰もやりません。"
              speed="約 10 分に 1 回"
              power="非常に多い（それが安全の根拠）"
              note="2009 年から一度も止まっていない"
              analogy="マラソンで一番になった人が議事録を書く方式。参加するだけで体力（電気）を使うので、いたずら目的の人が寄ってこない。"
            />
            <WayCard
              name="Ethereum — お金を預けた人が書く"
              rule="書く権利がほしい人は、まず自分のお金を預けます。不正をすれば、その預けたお金が没収されます。損をするから、みんな正直にふるまいます。"
              speed="約 12 秒に 1 回"
              power="少ない"
              note="台帳の上でプログラムを動かせるのが最大の特徴"
              analogy="保証金を積んだ人だけが議事録を書ける方式。ウソを書いたら保証金が返ってこない。"
            />
            <WayCard
              name="XRPL — みんなで多数決"
              rule="あらかじめ決まった人たちが「この取引を書いていいか」を投票します。8 割を超えたら決定です。競争しないので、電気も時間もほとんど使いません。"
              speed="3〜5 秒に 1 回"
              power="ほとんど使わない"
              note="「その人たちが結託しない」ことが前提"
              analogy="委員の 8 割が賛成したら議事録に載せる方式。速いが、その委員会を信用できるかにかかっている。"
            />
          </div>
          <Key>
            どれが優れている、という話ではありません。
            Bitcoin は<strong>電気</strong>で安全を買い、XRPL は<strong>人の多様性</strong>で買っている。
            何を信じるかが違うだけです。
          </Key>
          <Word term="バリデータ">
            XRPL で投票する人（正確にはサーバ）のこと。誰でもなれるが、
            他の人から「この人の票を聞く」と選ばれないと影響力を持たない。
          </Word>
        </Chapter>

        {/* 5 */}
        <Chapter n={5} title="このサイトのデモは、何をしていたのか">
          <T>
            江戸時代の大坂に、お米を預かる大きな倉庫（蔵屋敷）がありました。
            各地の藩が、税として集めたお米をそこに運び込みます。
          </T>
          <T>
            お米を預けると、倉庫の担当者（蔵元）が紙を 1 枚くれます。
            そこには「お米 100 石をたしかにお預かりしました」と書いてあります。
            これが<strong>米切手（こめきって）</strong>です。
            この紙を持っていけば、いつでもお米と交換してもらえます。
          </T>
          <T>
            ここからが面白いところで、<strong>この紙そのものが売り買いされました</strong>。
            重いお米を運ぶより、紙を渡すほうが楽だからです。
            大坂の堂島には、この紙を取引する市場までできました。
          </T>
          <Key>
            大事なのは、紙はお米そのものではない、ということです。
            紙は「倉庫がお米を返します」という<strong>約束</strong>です。
            だから、倉庫が焼けたら、紙はただの紙になります。
          </Key>
          <T>
            デモがやっていたのは、これをインターネット上で再現することでした。
            登場人物を 3 人（倉庫・預けた藩・買いたい商人）作り、
            紙を発行して、市場に出して、売る。
          </T>
          <div className="max-w-2xl rounded-lg border border-border bg-surface p-4">
            <p className="text-sm font-semibold">デモの結果（実測）</p>
            <ul className="mt-2 space-y-1.5 text-sm leading-8">
              <li>· 全部で <strong>6 回</strong>の記録</li>
              <li>· かかった時間 <strong>約 1 分</strong>（うち 20 秒は口座に入金を待つ時間）</li>
              <li>· 手数料の合計 <strong>0.000072 XRP</strong>（日本円で 0.01 円くらい）</li>
              <li>· 書いたプログラム <strong>0 行</strong>（用意されている機能を呼んだだけ）</li>
            </ul>
          </div>
          <T>
            そして、その記録は倉庫の許可がなくても、世界中の誰でも見て確かめられます。
            紙の時代には不可能だったのは、この点です。
          </T>
        </Chapter>

        {/* 6 */}
        <Chapter n={6} title="「1 分」「0.01 円」は、何がすごいのか">
          <T>
            正直に言うと、<strong>日本に住んでいるとあまりピンときません</strong>。
            日本の銀行振込は速いし、確実だからです。
          </T>
          <T>
            ピンとくるのは、次のような人たちです。
          </T>
          <ul className="max-w-2xl space-y-3 text-[15px] leading-9">
            <li>
              <strong>· 海外に毎月お金を送る人。</strong>
              日本からフィリピンに 3 万円送ると、手数料と為替で 2,000〜3,000 円が消えます。
              しかも数日かかります。世界平均では送金額の 6.7% が手数料です。
            </li>
            <li>
              <strong>· 1 円未満のお金を配りたい人。</strong>
              銀行振込の手数料が数百円なので、
              「1 円を 1,000 人に配る」は原理的に不可能でした。
              ここが変わったのは、この 10 年で初めてのことです。
            </li>
            <li>
              <strong>· 銀行口座を持てない人。</strong>
              世界にはまだ大勢います。
            </li>
          </ul>
          <Key>
            技術が広まるのは「便利だから」ではなく、
            <strong>「今のやり方が壊れているから」</strong>です。
            日本の銀行は壊れていないので、日本での説得力は弱い。これは正直に認めるべきところです。
          </Key>
        </Chapter>

        {/* 7 */}
        <Chapter n={7} title="では、資料やアーカイブの世界で何に使えるのか">
          <T>
            ここまで読んで「お金の話ばかりだ」と思われたはずです。そのとおりです。
            ブロックチェーンはもともとお金のための仕組みで、
            資料のための仕組みではありません。
          </T>
          <T>
            それでも、ひとつだけ、すぐに役に立つ使い方があります。
          </T>
          <Key>
            「この画像は、この日に、この内容で存在した」ことを、
            機関の外にいる人が確かめられるようにすること。
          </Key>
          <T>
            いまは、公開されているデジタル画像が
            あとからこっそり差し替えられていないかどうかを、外の人が確かめる方法がありません。
            「あの機関は差し替えたりしない」と信じるしかない。
          </T>
          <T>
            ここで<strong>ハッシュ</strong>という道具を使います。
            ファイルの中身から計算して出す、64 桁の数字です。
            中身が 1 バイトでも変われば、まったく違う数字になります。
            指紋のようなものだと思ってください。
          </T>
          <Word term="ハッシュ">
            ファイルの中身から計算される、決まった長さの数字。
            同じ中身からは必ず同じ数字が出る。中身が少しでも違えば、まったく別の数字になる。
            数字から元の中身を復元することはできない。
          </Word>
          <T>
            この指紋を、あとから誰にも書き換えられない場所に置いておく。
            そうすれば「今の画像の指紋」と「あの日に記録した指紋」を照合するだけで、
            差し替えられていないことを誰でも確認できます。
          </T>
          <T>
            しかも、<strong>置くのは指紋だけで、画像そのものは載せません</strong>。
            だから非公開の資料でも使えます。
            そして費用は 0 円です（大勢の指紋をまとめて 1 回で記録する仕組みがあるため）。
          </T>
          <div className="max-w-2xl rounded-lg border border-ok/40 bg-surface p-4 text-sm leading-8">
            この使い方だけは、<strong>今日から、既存のシステムに一切触らずに</strong>始められます。
            くわしくは
            <Link href="/apply" className="mx-1 text-accent underline underline-offset-2">
              応用のページ
            </Link>
            の「アプリ案 01」に書きました。
          </div>
        </Chapter>

        {/* 8 */}
        <Chapter n={8} title="気をつけること、3 つだけ">
          <div className="space-y-4">
            <div className="max-w-2xl rounded-lg border border-warn/40 bg-surface p-4">
              <p className="text-sm font-semibold">1.「書き換えられない」は「正しい」ではない</p>
              <p className="mt-1.5 text-sm leading-8">
                ウソを書き込めば、そのウソが永久に残ります。
                台帳が保証するのは「誰が、いつ、そう書いたか」だけで、
                書かれた内容が本当かどうかは保証しません。
                「ブロックチェーンに載っているから正しい」は、完全な誤解です。
              </p>
            </div>
            <div className="max-w-2xl rounded-lg border border-warn/40 bg-surface p-4">
              <p className="text-sm font-semibold">2. 取り消せない</p>
              <p className="mt-1.5 text-sm leading-8">
                送り先を 1 文字間違えたら、それで終わりです。
                銀行のような「組戻し」の窓口はありません。
                鍵をなくしても、本人確認で復旧してくれる人はいません。
              </p>
            </div>
            <div className="max-w-2xl rounded-lg border border-warn/40 bg-surface p-4">
              <p className="text-sm font-semibold">3. たいていの場合、要らない</p>
              <p className="mt-1.5 text-sm leading-8">
                第 2 章に書いたとおりです。書く人を信用できるなら、
                普通のデータベースのほうが速くて安くて便利です。
                「ブロックチェーンを使うこと」を目的にすると、必ず失敗します。
              </p>
            </div>
          </div>
          <div className="mt-6 max-w-2xl rounded-lg border border-border bg-surface-2 p-4 text-sm leading-8">
            <p className="font-semibold">次に読むなら</p>
            <ul className="mt-2 space-y-1.5">
              <li>
                ·{' '}
                <Link href="/" className="text-accent underline underline-offset-2">
                  デモを動かす
                </Link>{' '}
                — 第 5 章の 6 ステップを、実際にボタンを押して試せます
              </li>
              <li>
                ·{' '}
                <Link href="/learn" className="text-accent underline underline-offset-2">
                  ゆっくり読む XRPL
                </Link>{' '}
                — このページの内容を、もう一段くわしく
              </li>
              <li>
                ·{' '}
                <Link href="/apply" className="text-accent underline underline-offset-2">
                  何を、どの台帳で
                </Link>{' '}
                — 資料・アーカイブの分野で何が作れるか
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
        </Chapter>

        {/* 用語辞典 */}
        <section className="scroll-mt-20 border-t border-border pt-10" id="glossary">
          <h2 className="text-lg font-bold sm:text-xl">用語辞典</h2>
          <p className="mt-2 text-sm leading-8 text-ink-soft">
            このサイトで出てくる言葉を、五十音ではなく「理解する順」に並べました。
          </p>
          <dl className="mt-5 max-w-2xl">
            <Term word="台帳" reading="だいちょう">
              誰が誰にいくら払ったかを書いた記録。銀行の残高もこれ。
            </Term>
            <Term word="ブロックチェーン">
              同じ台帳のコピーを大勢が持ち、書き足すときだけ全員で確認する仕組み。
            </Term>
            <Term word="トランザクション">
              台帳に書き足す 1 件の記録。「A から B へ 10 送る」など。「取引」と訳される。
            </Term>
            <Term word="レジャー" reading="ledger">
              台帳の英語。XRPL では、3〜5 秒ごとに閉じる「台帳の 1 ページ」を指すことが多い。
            </Term>
            <Term word="ハッシュ">
              ファイルの中身から計算される数字。指紋のようなもの。中身が変わればまったく別の数字になる。
            </Term>
            <Term word="秘密鍵" reading="ひみつかぎ">
              あなたが本人であることを示す、長い乱数。パスワードと違って再発行できない。なくしたら終わり。
            </Term>
            <Term word="アドレス">
              秘密鍵から計算して作る、口座番号にあたる文字列。XRPL では r で始まる。
            </Term>
            <Term word="ウォレット" reading="財布">
              秘密鍵を保管するソフトやアプリ。お金が入っているのではなく、鍵が入っている。
            </Term>
            <Term word="バリデータ">
              XRPL で「この記録を書いてよいか」を投票するサーバ。誰でも運営できる。
            </Term>
            <Term word="ファイナリティ" reading="確定">
              「もうこの記録は覆らない」と言える状態。XRPL では記録された瞬間、Bitcoin では約 1 時間後。
            </Term>
            <Term word="手数料" reading="XRPL では drops 単位">
              記録を書き込むときに払う額。XRPL では 1 件 0.000012 XRP で、誰の収入にもならず消滅する。
            </Term>
            <Term word="トークン">
              台帳の上で発行される、XRP 以外の資産。デモの米切手もトークン。
            </Term>
            <Term word="IOU" reading="アイ・オー・ユー / I owe you">
              「借りがある」の意。XRPL のトークンは発行した人の借金として記録される。米切手と同じ。
            </Term>
            <Term word="信用線" reading="トラストライン">
              「この発行者のトークンを、いくらまで受け取ります」という宣言。宣言がないと届かない。
            </Term>
            <Term word="板 / DEX" reading="いた / 分散型取引所">
              売り注文と買い注文が並ぶ場所。XRPL では取引所を別に用意せず、台帳自体が板を持っている。
            </Term>
            <Term word="スマートコントラクト">
              台帳の上で動くプログラム。Ethereum の特徴。XRPL には無く、代わりに機能が最初から用意されている。
            </Term>
            <Term word="ステーブルコイン">
              円やドルの価値に連動するように作られたトークン。発行者が裏付け資産を持つことで価値を保つ。
            </Term>
            <Term word="NFT">
              1 点ものとして発行されるトークン。デジタル作品の売買に使われたが、
              公共の資料との相性は悪い（応用ページの案 10 を参照）。
            </Term>
            <Term word="タイムスタンプ">
              「この時刻に、これが存在した」ことの証明。資料の分野で最も出番が多い使い方。
            </Term>
            <Term word="テストネット">
              本番と同じ仕組みで動く練習用のネットワーク。お金の価値はない。このデモはここで動いている。
            </Term>
            <Term word="ドロップ" reading="drop">
              XRP の最小単位。1 XRP = 100 万 drops。手数料はこの単位で表示される。
            </Term>
          </dl>
        </section>
      </div>

      <footer className="mt-12 border-t border-border pt-6 text-xs leading-7 text-ink-soft">
        <p>
          分かりにくいところがあれば、それは書き方の問題です。
          このページは、読んで分からなかった箇所を教えてもらうたびに書き直す前提で置いています。
        </p>
        <p className="mt-3">
          <Link href="/" className="text-accent underline underline-offset-2">
            ← デモに戻る
          </Link>
        </p>
      </footer>
    </main>
  );
}
