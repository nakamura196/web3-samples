/**
 * 用語集 — このデモに出てくる語を、その場で引けるようにする。
 *
 * 方針: LLM を呼ばない。XRPL の語彙は有限で安定しており、
 * 講義中に出る質問はほぼ想定できる。固定の回答を持っておけば、
 * 即座に・無料で・オフラインでも・内容が確定した状態で答えられる。
 * このアプリがバックエンドを持たないという前提 (README・トップの注意書き) も壊さない。
 *
 * `short` はポップオーバーの一行目。`long` は展開したときの本文。
 * 本文中の `バッククォート` は等幅で表示される (renderInline)。
 */

export type TermCategory = 'ledger' | 'account' | 'money' | 'token' | 'tx' | 'dex' | 'result' | 'api';

export const CATEGORY_LABEL: Record<TermCategory, string> = {
  ledger: '台帳と合意形成',
  account: '口座と鍵',
  money: 'XRP と金額',
  token: 'トークン (IOU)',
  tx: 'トランザクション',
  dex: 'DEX と取引',
  result: '結果コード',
  api: 'API とライブラリ',
};

/** カテゴリの表示順 */
export const CATEGORY_ORDER: TermCategory[] = [
  'ledger',
  'account',
  'money',
  'token',
  'tx',
  'dex',
  'result',
  'api',
];

export interface GlossaryEntry {
  /** URL fragment にも使う識別子 */
  id: string;
  /** 見出しに出す表記 */
  term: string;
  /** 読み (かな)。検索対象になる */
  reading?: string;
  /** 本文中でこの項目に結びつける別表記。検索対象にもなる */
  aliases?: string[];
  category: TermCategory;
  /**
   * 日常語の見出し。語そのものが壁になっている場合だけ与える。
   * 「信用線」のように、知っている漢字を並べても意味が立ち上がらない語がある。
   * 本当の用語は括弧で残す — 消すと xrpl.org を読むときに困る。
   */
  plainTerm?: string;
  /** やさしい方の一行定義。専門語を使わずに書く */
  plain: string;
  /** 一行の定義。ポップオーバーで最初に見えるのはここだけ */
  short: string;
  /** 詳しい説明。段落ごとに配列の要素 1 つ */
  long: string[];
  /** 関連する項目の id */
  related?: string[];
  /** 一次資料 */
  href?: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  // ── 台帳と合意形成 ──────────────────────────────────────────
  {
    id: 'xrpl',
    term: 'XRP Ledger',
    reading: 'えっくすあーるぴーれっじゃー',
    aliases: ['XRPL'],
    category: 'ledger',
    plain: 'みんなで共有する取引の記録帳。特定の会社が持っているのではなく、世界中のサーバが同じ内容を持っている。',
    short: '2012 年に稼働を始めた公開台帳。マイニングをせず、validator の投票でレジャーを閉じる。',
    long: [
      'Bitcoin と同じく誰でも読み書きできる公開台帳だが、合意形成の方法が違う。採掘者が計算競争で次のブロックを決めるのではなく、あらかじめ選ばれた validator が投票を重ね、支持が 80% を超えた時点でレジャーが閉じる。消費するのは電力ではなく帯域である。',
      '結果として 3〜5 秒で決済が終わり、手数料は 1 トランザクションあたり 10〜15 drops (0.00001 XRP 前後) に収まる。代わりに「validator が結託しない」という賭けを引き受けている。PoW が電力で買っているものを、XRPL は名指しの信頼で買っている。',
      'トークン発行・オーダーブック・経路探索がプロトコルの一次機能として最初から入っているのが特徴で、これらを使うのにコントラクトのデプロイは要らない。一方、汎用スマートコントラクトは無い。',
    ],
    related: ['validator', 'unl', 'consensus', 'dex', 'amendment'],
    href: 'https://xrpl.org/docs',
  },
  {
    id: 'ledger',
    term: 'レジャー',
    reading: 'れっじゃー',
    aliases: ['ledger', 'ledger index', 'レジャー番号'],
    category: 'ledger',
    plainTerm: '記録帳の 1 ページ（レジャー）',
    plain: '記録帳の 1 ページぶん。3〜5 秒ごとに 1 ページ確定し、確定したら二度と書き換えられない。',
    short: '台帳の 1 世代ぶんのスナップショット。Bitcoin の「ブロック」にあたる。3〜5 秒ごとに 1 つ閉じる。',
    long: [
      '全口座の残高・信用線・板の注文といった状態をまとめて 1 枚に固めたもの。閉じるたびに通し番号 (ledger index) が 1 つ増える。デモの実行ログに出る `ledger #12345678` はこの番号で、「あなたのトランザクションはこの世代に載った」という意味である。',
      '検証済み (validated) になったレジャーは二度と書き換わらない。Bitcoin のように「後から長いチェーンが現れて巻き戻る」ことが原理的に起きないので、確認のために数ブロック待つ習慣が XRPL には無い。',
    ],
    related: ['consensus', 'finality', 'tessuccess'],
  },
  {
    id: 'consensus',
    term: '合意形成',
    reading: 'ごういけいせい',
    aliases: ['コンセンサス', 'consensus'],
    category: 'ledger',
    plainTerm: 'サーバたちの多数決（合意形成）',
    plain: '「次のページに何を書くか」をサーバたちの多数決で決める仕組み。8 割が賛成したら確定する。',
    short: 'validator が投票を繰り返し、支持が 80% を超えた時点でレジャーを確定させる手続き。',
    long: [
      '段階が 2 つある。まず各 validator が「次のレジャーにこのトランザクションを入れるべきだ」という提案を出し、周りを見て自分の案を寄せていく。この熟議はしきい値 50% から始まり、最終的に 80% の一致でトランザクション集合が決まる。',
      '次に、各サーバがその集合を適用したレジャーに署名する。信頼している validator の 80% 以上から同じレジャーへの署名 (validation) が集まった時点で、そのレジャーは検証済み (validated) になり、二度と変わらない。',
      '採掘が無いので、勝った者が報酬を得るという構造も無い。validator は手数料を受け取らないし、新規発行された XRP も受け取らない。「自分が使う台帳が正しく動くこと」自体が動機であり、取引所・大学・企業などが自前で走らせている。',
    ],
    related: ['validator', 'unl', 'finality'],
  },
  {
    id: 'validator',
    term: 'validator',
    reading: 'ばりでーた',
    aliases: ['バリデータ', '検証者'],
    category: 'ledger',
    plainTerm: '投票するサーバ（validator）',
    plain: 'その多数決に参加するサーバ。誰でも動かせるが、他の人に「あなたの票を数えます」と選ばれないと意味がない。',
    short: '合意形成に投票するサーバ。報酬を受け取らず、誰でも立てられる。',
    long: [
      'rippled (XRPL のサーバ実装) を投票モードで動かせば、誰でも validator になれる。許可も申請も要らない。',
      'ただし「立てられること」と「聞いてもらえること」は別である。あなたの投票が意味を持つのは、他のサーバがあなたを自分の UNL に載せたときだけ。信頼は勝手には発生せず、稼働実績を積んで獲得するものになっている。',
    ],
    related: ['unl', 'consensus'],
  },
  {
    id: 'unl',
    term: 'UNL',
    reading: 'ゆーえぬえる',
    aliases: ['Unique Node List', '信頼するバリデータ一覧'],
    category: 'ledger',
    plainTerm: '票を数える相手の名簿（UNL）',
    plain: '「どのサーバの票を数えるか」の名簿。サーバごとに自分で決める。',
    short: 'そのサーバが「投票を聞く相手」として選んだ validator の一覧。各サーバが自分で決める。',
    long: [
      'XRPL の分散性がどこにあるのかを理解する上で一番大事な概念。中央の名簿があるのではなく、サーバごとに「誰の声を聞くか」を自分で選ぶ。学術論文の引用リストに近い。',
      '現実には多くの運用者が既定の推奨リスト (Ripple や XRPL Foundation が公開しているもの) をそのまま使っており、ここが XRPL の中央集権性としてよく批判される点である。ただし仕組みとして強制されているわけではなく、いつでも自分で編集できる。「分散は生まれつきの性質ではなく、進む方向である」というのはこの話。',
    ],
    related: ['validator', 'consensus'],
  },
  {
    id: 'finality',
    term: 'ファイナリティ',
    reading: 'ふぁいなりてぃ',
    aliases: ['finality', '決定性', '最終性'],
    category: 'ledger',
    plainTerm: 'もう取り消せない状態（ファイナリティ）',
    plain: '取引が確定して、もう取り消されない状態。XRPL では 3〜5 秒でそこに届く。',
    short: '決済が確定して二度と覆らない状態。XRPL では `tesSUCCESS` がその時点で最終。',
    long: [
      'Bitcoin では「6 ブロック待つ」という慣習がある。後からより長いチェーンが現れれば自分の取引が無かったことになりうるので、確率的にしか確定しないためである。',
      'XRPL の確定は確率的ではなく決定的で、検証済み (validated) レジャーに載った時点で覆らない。だから「何ブロックか待って確信を高める」という手続きは要らない。ただし**検証済みになるまでの 3〜5 秒は待つ必要がある**。ゼロではない。',
      'なお「フォークが絶対に起きない」わけでもない。自分のサーバの UNL が他と十分に重なっていなければ、ネットワークから分岐しうるとドキュメントは明記している。重なりが保たれている限り分岐しない、というのが正確な言い方である。',
    ],
    related: ['tessuccess', 'ledger', 'consensus'],
  },
  {
    id: 'testnet',
    term: 'Testnet',
    reading: 'てすとねっと',
    aliases: ['テストネット'],
    category: 'ledger',
    plain: '練習用の記録帳。本物とそっくりだが、ここのお金に価値は無い。失敗しても損しない。',
    short: '本番と同じソフトが動く練習用の台帳。ここの XRP に金銭的価値は無い。',
    long: [
      '本番 (Mainnet) と同じ rippled が動いており、トランザクションの書き方も返ってくるエラーも同じ。違うのは XRP がタダで手に入ることと、価値が無いことだけである。',
      'このデモは Testnet にしかつながない。ただし習慣として、ここで生成した鍵に実資産を入れてはいけない。ブラウザのメモリに置かれ、リロードで消える前提の鍵である。',
      '結果は誰でも `testnet.xrpl.org` で検証できる。アドレスやトランザクションのハッシュを貼れば、あなたが送ったものがそのまま出てくる。',
    ],
    related: ['mainnet', 'faucet'],
    href: 'https://testnet.xrpl.org',
  },
  {
    id: 'mainnet',
    term: 'Mainnet',
    reading: 'めいんねっと',
    aliases: ['メインネット', '本番ネット'],
    category: 'ledger',
    plain: '本番の記録帳。ここの XRP には実際の値段が付いている。',
    short: '実際に価値のある XRP が動いている本番の台帳。',
    long: [
      'Testnet との違いはソフトウェアではなく、そこにある資産が本物かどうかだけ。だから Testnet で動いたコードは、接続先を変えれば本番でもそのまま動く。逆に言えば、間違いもそのまま動く。',
    ],
    related: ['testnet'],
  },
  {
    id: 'amendment',
    term: 'アムンドメント',
    reading: 'あむんどめんと',
    aliases: ['amendment', '修正案'],
    category: 'ledger',
    plainTerm: '機能を追加するための投票（アムンドメント）',
    plain: '新機能を入れるかどうかの投票。8 割の賛成が 2 週間続かないと入らない。',
    short: 'プロトコルへの機能追加。validator の 80% 支持が 2 週間続いて初めて有効になる。',
    long: [
      '新機能はコードに入っただけでは動かない。validator の 80% を**超える**支持が 2 週間継続して、ようやく台帳の挙動が変わる。途中で 80% を下回ると、2 週間の数え直しになる。ハードフォークで別のチェーンに分かれることなく仕様を変えていくための仕組みである。',
      'AMM も、v3.3.0 のネイティブなプライバシー機能も、この手続きを通って入った。裏を返せば、多数派が支持しない変更は入らない。',
    ],
    related: ['validator', 'amm'],
  },

  // ── 口座と鍵 ────────────────────────────────────────────────
  {
    id: 'wallet',
    term: 'ウォレット',
    reading: 'うぉれっと',
    aliases: ['Wallet', '財布'],
    category: 'account',
    plainTerm: 'ハンコを押す道具（ウォレット）',
    plain: '印鑑のようなもの。お金が入っているのではなく、「自分のお金を動かす権利」を証明する道具。',
    short: '鍵ペアを保持するオブジェクト。`xrpl.js` では `Wallet` クラス。',
    long: [
      '「お金が入っている財布」というより「署名する道具」と考えたほうが正確である。残高は台帳の側にあり、ウォレットが持っているのは、その残高を動かす権利を証明するための秘密鍵だけ。',
      'このデモの `Wallet.generate()` はブラウザの中で鍵を作る。既定の鍵方式は ed25519 で、Bitcoin や Ethereum が使う secp256k1 も選べる。作られた鍵はサーバに送られない — このアプリにバックエンドが無いのはそのためである。',
    ],
    related: ['address', 'seed', 'reserve'],
  },
  {
    id: 'address',
    term: 'アドレス',
    reading: 'あどれす',
    aliases: ['address', 'クラシックアドレス'],
    category: 'account',
    plainTerm: '口座番号（アドレス）',
    plain: '口座番号にあたる文字列。r から始まる。人に教えてよい。',
    short: '`r` で始まる口座の識別子。公開してよい。',
    long: [
      '公開鍵から導出される 25〜35 文字の文字列で、必ず `r` で始まる。銀行口座番号にあたるもので、人に教えて構わない。教えて困るのはシード (秘密鍵) のほうである。',
      '内部にチェックサムが入っているので、1 文字打ち間違えるとアドレスとして不正になり、送信前に弾かれる。誤送金がある程度は構造的に防がれている。',
    ],
    related: ['seed', 'wallet'],
  },
  {
    id: 'seed',
    term: 'シード',
    reading: 'しーど',
    aliases: ['seed', '秘密鍵', 'ファミリーシード'],
    category: 'account',
    plainTerm: 'ハンコそのもの（シード / 秘密鍵）',
    plain: '印鑑そのもの。これを知られたら口座を乗っ取られる。絶対に人に見せない。',
    short: '鍵ペアの元になる秘密の値。`s` で始まる。これを持つ者が口座を支配する。',
    long: [
      'シードから秘密鍵が導かれ、秘密鍵から公開鍵とアドレスが導かれる。したがってシードを知る者はその口座のすべてを動かせる。パスワードのように「変更」できるものではない (鍵の付け替えはできるが別の操作になる)。',
      'このデモではシードを画面に出さないし、どこにも保存しない。リロードすれば失われる。Testnet の口座は台帳上に残るが、二度と署名できなくなる。',
    ],
    related: ['address', 'wallet', 'multisig'],
  },
  {
    id: 'reserve',
    term: '準備金',
    reading: 'じゅんびきん',
    aliases: ['reserve', 'base reserve', 'owner reserve', '予約金'],
    category: 'account',
    plainTerm: '口座の敷金（準備金 / reserve）',
    plain: '口座を持つのにかかる敷金のようなもの。1 XRP。使えないが、無くなったわけでもない。',
    short: '口座を維持するために台帳へ預けておく XRP。使えないが、消えたわけでもない。',
    long: [
      '口座が存在するだけで base reserve として 1 XRP、信用線や板の注文などのオブジェクトを 1 つ持つごとに owner reserve として 0.2 XRP が凍結される (2026 年 8 月現在)。2024 年 12 月 2 日の validator による手数料投票で、それぞれ 10 XRP と 2 XRP から引き下げられた。',
      'この値は固定ではない。validator の投票でまた変わりうるので、実装するときは決め打ちにせず台帳に問い合わせること。',
      '目的は台帳をゴミ捨て場にしないこと。無限に空口座を作られると全 validator のメモリを圧迫するので、家賃を取ることで抑止している。',
      '没収ではない。信用線を閉じたり注文を取り消したりすれば owner reserve は解放される。ただし base reserve のぶんは口座を消さない限り戻らない。',
    ],
    related: ['ownercount', 'trustline', 'offercreate'],
  },
  {
    id: 'ownercount',
    term: 'OwnerCount',
    reading: 'おーなーかうんと',
    aliases: ['オブジェクト数'],
    category: 'account',
    plainTerm: '持ち物の数（OwnerCount）',
    plain: 'その口座が持っている「物」の数。多いほど敷金が増える。',
    short: 'その口座が持つ台帳オブジェクトの数。準備金の計算に使われる。',
    long: [
      '信用線 1 本、板に出した注文 1 件、それぞれが 1 つとして数えられる。デモの口座カードに出ている数字がこれで、`OwnerCount × 0.2 XRP` が凍結されている額になる。',
      '③ で信用線を引くと増え、⑤ で注文を出すとまた増える。⑥ で注文が使い切られると減る。数字が動くのを見ると、準備金が何に対して課金されているかが分かる。',
    ],
    related: ['reserve', 'trustline'],
  },
  {
    id: 'faucet',
    term: 'フォーセット',
    reading: 'ふぉーせっと',
    aliases: ['faucet', '蛇口'],
    category: 'account',
    plainTerm: '練習用のお金をくれる蛇口（フォーセット）',
    plain: '練習用のお金をタダで配ってくれる蛇口。',
    short: 'Testnet のテスト XRP を無料で配る蛇口。口座を開くのに使う。',
    long: [
      'XRPL の口座は準備金が入って初めて存在するので、鍵を作っただけでは台帳の上に何も無い。faucet に自分のアドレスを渡すと、そこへテスト XRP が振り込まれ、同時に口座が開く。',
      '`client.fundWallet(wallet)` の一行がこれをやっている。渡しているのはアドレスだけで、鍵は渡していない。',
      '流量制限があるので、短時間に何度もリセットして実行すると失敗することがある。少し待てば通る。',
    ],
    related: ['testnet', 'reserve', 'wallet'],
  },
  {
    id: 'multisig',
    term: 'マルチシグ',
    reading: 'まるちしぐ',
    aliases: ['multisig', '多重署名'],
    category: 'account',
    plainTerm: '複数人のハンコで動かす（マルチシグ）',
    plain: '1 つの口座を複数人のハンコで動かす設定。1 人では動かせなくなる。',
    short: '1 つの口座を複数の鍵で共同管理する仕組み。プロトコルに内蔵されている。',
    long: [
      '「8 人のうち 5 人が署名したら実行してよい」といった条件を口座そのものに設定できる。鍵を持つのが個人ではなく委員会になる、ということ。',
      'Ethereum ではこれをスマートコントラクト (Gnosis Safe など) で実現するが、XRPL では口座の標準機能なので、デプロイも監査も要らない。組織の資産管理や、大学のような合議で動く主体には効いてくる。',
    ],
    related: ['seed', 'accountset'],
  },

  // ── XRP と金額 ──────────────────────────────────────────────
  {
    id: 'xrp',
    term: 'XRP',
    reading: 'えっくすあーるぴー',
    category: 'money',
    plain: 'XRPL の基本のお金。発行した人がいないので、誰かが潰れても価値が消えない。',
    short: '台帳のネイティブ資産。発行体が存在せず、誰の負債でもない。',
    long: [
      'XRPL の中で唯一、発行体を持たない資産である。トークン (IOU) が必ず「誰かの負債」であるのに対し、XRP は誰の負債でもない。だから相手方リスクがゼロで、受け取るのに事前の同意も要らない。',
      '手数料の支払いと準備金に使われるほか、通貨どうしをつなぐ橋渡しの資産としても使われる。経路探索が「A トークン → XRP → B トークン」という経路を返してくるのはこのため。',
      '総量は 2012 年の稼働開始時に 1000 億が発行済みで、新しく発行する仕組みが存在しない。しかも手数料の分が焼却され続けるので、実際にはごくわずかずつ減っていく。',
    ],
    related: ['drops', 'iou', 'counterparty-risk', 'pathfinding'],
  },
  {
    id: 'drops',
    term: 'drops',
    reading: 'どろっぷす',
    aliases: ['ドロップ'],
    category: 'money',
    plainTerm: 'XRP の細かい単位（drops）',
    plain: 'XRP の細かい単位。1 XRP = 100 万 drops。プログラムはこの単位で受け取る。',
    short: 'XRP の最小単位。1 XRP = 1,000,000 drops。API はこの単位で受け取る。',
    long: [
      'XRPL の内部では XRP の金額をすべて整数の drops で扱う。小数を使わないので、丸め誤差が原理的に発生しない。',
      'だからコードでは必ず変換が要る。`xrpl.xrpToDrops("25")` は文字列 `"25000000"` を返し、逆は `dropsToXrp()`。ここを忘れて `"25"` をそのまま渡すと、25 XRP のつもりが 25 drops (0.000025 XRP) になる。',
      'デモの手数料表示が `120 drops = 0.000120 XRP` のようになっているのは、この単位で台帳に記録されているからである。',
    ],
    related: ['xrp', 'fee', 'amount'],
  },
  {
    id: 'fee',
    term: '手数料',
    reading: 'てすうりょう',
    aliases: ['Fee', 'トランザクション手数料'],
    category: 'money',
    plain: '取引 1 回につき 0.00001 XRP ほど。誰の懐にも入らず、消えてなくなる。',
    short: '1 トランザクションあたり 10〜15 drops 程度。誰にも渡らず焼却される。',
    long: [
      '採掘者も validator も手数料を受け取らない。支払われた XRP はそのまま消滅する。手数料は誰かへの報酬ではなく、スパム防止のためのコストとして設計されている。',
      '負荷が高まると自動的に上がり、収まると戻る。`autofill` が現在の相場を見て埋めてくれるので、通常は自分で指定しない。',
      '重要な性質として、`tec` 系のエラーで失敗したトランザクションも手数料を消費する。「失敗した」という記録を台帳に載せるための対価である。',
    ],
    related: ['drops', 'autofill', 'tec'],
  },

  // ── トークン (IOU) ──────────────────────────────────────────
  {
    id: 'iou',
    term: 'IOU',
    reading: 'あいおーゆー',
    aliases: ['issued currency', '発行済み通貨', 'トークン'],
    category: 'token',
    plainTerm: 'あとで渡すという約束の紙（IOU）',
    plain: '「あとで渡します」という約束の紙。書いた人が守らなければ、ただの紙になる。',
    short: '"I Owe You" (借用証書)。XRPL のトークンはすべて発行体の負債として記録される。',
    long: [
      'XRP 以外の資産は、例外なく誰かの負債である。台帳が記録しているのは「誰が誰にいくら負っているか」であって、資産そのものではない。米切手が米そのものではなく蔵屋敷の負債であったのと同じ構造である。',
      'したがって同じ通貨コードでも、発行体が違えば別の資産になる。「A 藩の蔵屋敷の 100 石」と「B 藩の蔵屋敷の 100 石」は交換可能ではない。デモで残高表示に必ず発行体が付いてくるのはこのため。',
      '発行体が飛べば、その IOU は価値を失う。台帳は「誰が何を負ったか」の記録を保証するだけで、負債が履行されることまでは保証しない。蔵が焼ければ切手はただの紙になる。',
    ],
    related: ['issuer', 'counterparty-risk', 'trustline', 'xrp'],
  },
  {
    id: 'issuer',
    term: '発行体',
    reading: 'はっこうたい',
    aliases: ['issuer', '発行者'],
    category: 'token',
    plainTerm: 'その紙を書いた人（発行体）',
    plain: 'その約束の紙を書いた人。誰が書いたかまで含めて「どのトークンか」が決まる。',
    short: 'トークンを発行したアドレス。通貨コードと組で、はじめて資産が特定される。',
    long: [
      'XRPL のトークンは「通貨コード + 発行体アドレス」の組で識別される。`KOK` だけでは資産を指定したことにならず、必ず「どの発行体の `KOK` か」まで書く必要がある。',
      '発行体になるための申請や許可は無い。任意の口座が `DefaultRipple` を立て、誰かに Payment を送れば、その瞬間から発行体である。',
      '発行体自身の残高はマイナスで表示される。負債を負っている側だからで、デモで蔵元の残高が `-25 KOK, -75 KOK` のように 2 行に分かれるのは、藩と米仲買それぞれに対して別々に負債を負っているためである。',
    ],
    related: ['iou', 'defaultripple', 'currency-code', 'counterparty-risk'],
  },
  {
    id: 'currency-code',
    term: '通貨コード',
    reading: 'つうかこーど',
    aliases: ['currency code', 'currency'],
    category: 'token',
    plainTerm: 'トークンの名前（通貨コード）',
    plain: 'トークンの名前。アルファベット 3 文字が基本。',
    short: 'トークンの名前。ASCII 3 文字が標準。40 文字の hex 形式なら任意の名前も使える。',
    long: [
      '`USD` `JPY` `KOK` のような 3 文字が標準形式で、デモが使っているのもこれ。ISO の通貨コードに揃える必要はなく、独自の 3 文字で構わない。',
      '3 文字に収まらない名前を使いたい場合は、160 ビット (hex 40 文字) の形式が使える。`RiceNote` のような長い名前はこちらになる。ただし対応していないウォレットやエクスプローラでは生の hex のまま表示される。',
      '使えないのは**大文字の `XRP`** だけである。小文字の `xrp` は通貨コードとして有効だが、紛らわしいので避けたほうがよい。3 文字コードは大文字と小文字を区別し、一部の記号も使える。',
    ],
    related: ['iou', 'issuer'],
  },
  {
    id: 'trustline',
    term: 'トラストライン',
    reading: 'とらすとらいん',
    aliases: ['trust line', '信用線'],
    category: 'token',
    plainTerm: '受け取る前の同意（トラストライン / 信用線）',
    plain: '「この人の約束の紙なら受け取ります」という事前の同意。これが無いと届かない。',
    short: '「この発行体のこの通貨を、上限いくらまで持つ」という受け手側の同意。無ければトークンは届かない。',
    long: [
      'XRPL で最も特徴的な仕組み。同意なくして残高なし。信用線が引かれていない口座に IOU を `Payment` で送ると `tecPATH_DRY` で失敗する。失敗しても台帳には記録され、手数料の XRP は焼却される。',
      'ただし例外がある。DEX でトークンを買った場合には信用線が暗黙に作られる。「信用線が無いと絶対に受け取れない」わけではなく、正確には「送りつけられることはない」である。',
      'なぜこうなっているかというと、IOU が発行体の負債だからである。負債を押し付けられない権利がプロトコル層に埋め込まれている、と読むのが正しい。誰かが勝手に送りつけてくる無価値なトークンで残高が汚れることも、これで防がれている。',
      'limit の値は「この発行体のリスクをいくらまで引き受けるか」の自己申告。与信管理がアプリ層ではなくプロトコル層にあるということで、伝統的な金融システムとの一番大きな違いはここかもしれない。',
      '信用線 1 本につき owner reserve 0.2 XRP がかかる。持てるトークンの数に、静かな上限が効いている。',
    ],
    related: ['trustset', 'iou', 'reserve', 'counterparty-risk'],
  },
  {
    id: 'counterparty-risk',
    term: '相手方リスク',
    reading: 'あいてがたりすく',
    aliases: ['counterparty risk', 'カウンターパーティリスク'],
    category: 'token',
    plainTerm: '相手が約束を守らない危険（相手方リスク）',
    plain: '約束した相手が守ってくれない危険。XRP には無いが、トークンには必ずある。',
    short: '発行体が履行しない可能性。XRP にはゼロ、IOU には必ず存在する。',
    long: [
      '台帳の上で残高が正しく記録されていることと、その残高が実際に価値と引き換えられることは別問題である。台帳は前者しか保証しない。',
      'だから XRPL では「どの発行体か」が資産の一部として扱われている。同じ 100 単位でも、信用できる発行体のものと怪しい発行体のものは別の値段が付く。江戸時代に藩によって米切手の値が違ったのと同じことが、そのまま台帳の設計に入っている。',
      '信用線の limit は、このリスクに自分で上限を付ける操作である。',
    ],
    related: ['iou', 'trustline', 'issuer', 'xrp'],
  },
  {
    id: 'defaultripple',
    term: 'DefaultRipple',
    reading: 'でふぉるとりっぷる',
    aliases: ['asfDefaultRipple'],
    category: 'token',
    plainTerm: '発行体になるスイッチ（DefaultRipple）',
    plain: '「自分は発行体です」というスイッチ。入れ忘れると、持ち主どうしの送金だけができなくなる。',
    short: '発行体になるためのフラグ。無いと保有者どうしの Payment が `tecPATH_DRY` で落ちる。',
    long: [
      '発行体を経由した保有者どうしの残高移動 (rippling) を許可するフラグ。これが無いと、藩から米仲買へ `Payment` でトークンを送れない。',
      '厄介なのは、失敗する場所が限られていること。Testnet で実測したところ、このフラグが無くても発行 (④) も板への注文 (⑤) も板の約定 (⑥) も `tesSUCCESS` で通った。約定は rippling を経由しないためである。落ちたのは保有者どうしの直接送金だけで、そこで `tecPATH_DRY` が返った。',
      'つまりこのデモは ② を飛ばしても最後まで完走してしまう。設定漏れが表に出るのは、発行したトークンを人から人へ渡そうとした本番の場面である。気づくのが最も遅れる種類の漏れで、デモが ② を独立したステップにしているのはそのためである。',
    ],
    related: ['rippling', 'issuer', 'accountset', 'tecpathdry'],
  },
  {
    id: 'rippling',
    term: 'rippling',
    reading: 'りっぷりんぐ',
    aliases: ['リップリング'],
    category: 'token',
    plainTerm: '発行体を経由した残高の移動（rippling）',
    plain: '発行体を経由して、持ち主から持ち主へ残高が移ること。',
    short: '発行体を経由して、保有者どうしの残高が玉突きに移動すること。',
    long: [
      '藩が持つ「蔵元への債権」を米仲買に渡すとき、台帳の上では蔵元の負債の相手先が藩から米仲買へ書き換わる。蔵元を中継点として残高が波及していくので rippling と呼ばれる。プロトコル名の Ripple もここから来ている。',
      '発行体としては当然許可すべき動きなので `DefaultRipple` を立てる。逆に一般の利用者にとっては、意図しない残高移動の経路になりうるため既定では無効になっている。',
    ],
    related: ['defaultripple', 'issuer', 'pathfinding'],
  },

  // ── トランザクション ────────────────────────────────────────
  {
    id: 'transaction',
    term: 'トランザクション',
    reading: 'とらんざくしょん',
    aliases: ['transaction', 'tx'],
    category: 'tx',
    plainTerm: '記録帳への書き込み（トランザクション）',
    plain: '記録帳への 1 回の書き込み。ハンコを押して送り、ページに載って初めて効く。',
    short: '台帳に対する 1 回の書き込み要求。署名して投げ、レジャーに載って初めて効力を持つ。',
    long: [
      '`TransactionType` で種類が決まる。デモで使うのは `AccountSet` `TrustSet` `Payment` `OfferCreate` の 4 つ。',
      'どのトランザクションも原子的である。途中まで実行されるということが無い。⑥ で「XRP を渡す」と「トークンを受け取る」が同時に起きるのはこのため。片方だけ成立することはない。',
    ],
    related: ['payment', 'trustset', 'offercreate', 'accountset', 'submitandwait'],
  },
  {
    id: 'payment',
    term: 'Payment',
    reading: 'ぺいめんと',
    aliases: ['支払い'],
    category: 'tx',
    plainTerm: '送金の命令（Payment）',
    plain: '送金の命令。XRP を送るときもトークンを送るときも、これを使う。',
    short: '資産を送るトランザクション。XRP もトークンも同じ型で送る。',
    long: [
      '講演スライドの言い方を借りれば、5 つのフィールドが 1 つの支払いを記述する。`TransactionType` (種類)、`Account` (署名し支払う者)、`Destination` (入金される者)、`DeliverMax` (何を届けるか)、`Paths` (任意。経由する経路)。',
      'XRP を送るときとトークンを送るときで、変わるのは金額の書き方だけである。XRP なら drops の文字列、トークンなら `currency` `issuer` `value` を持つオブジェクト。この `issuer` の有無が、XRP とトークンの決定的な違いをそのまま表している。',
      '発行体が自分のトークンを Payment で送ると、それは「発行」になる。新しい取引種別は要らない。負債が生まれる瞬間が、ただの送金として表現されている。',
    ],
    related: ['amount', 'iou', 'xrp', 'pathfinding'],
  },
  {
    id: 'amount',
    term: 'DeliverMax',
    reading: 'でりばーまっくす',
    aliases: ['Amount', '金額フィールド'],
    category: 'tx',
    plainTerm: 'いくら送るか（DeliverMax / Amount）',
    plain: 'いくら送るか。XRP なら数字だけ、トークンなら「誰が発行したか」も一緒に書く。',
    short: '届ける資産と量。XRP は drops の文字列、トークンはオブジェクト。',
    long: [
      'XRP のとき: `DeliverMax: xrpl.xrpToDrops("25")` → `"25000000"` という文字列になる。',
      'トークンのとき: `DeliverMax: { currency: "KOK", issuer: kuramoto.address, value: "100" }`。発行体を書かないと資産が特定できないので、`issuer` は省略できない。',
      '名前について。もとは `Amount` という名前で、API の成熟にともなって `DeliverMax` に改称された。`xrpl.js` の型定義はまだ `Amount` を使っているので、デモのコードでは `Amount` と書いてある。指しているものは同じである。',
      '数値ではなく文字列で書くことに注意。JavaScript の数値型では精度が落ちるためで、金額はすべて文字列として扱う。',
    ],
    related: ['payment', 'drops', 'iou'],
  },
  {
    id: 'trustset',
    term: 'TrustSet',
    reading: 'とらすとせっと',
    category: 'tx',
    plainTerm: '同意を宣言する命令（TrustSet）',
    plain: '「この人の紙を受け取ります」と宣言する命令。受け取る側が出す。',
    short: '信用線を引く/変更するトランザクション。トークンの受け手側が出す。',
    long: [
      '`LimitAmount` に `currency` `issuer` `value` を書いて送る。「この発行体のこのトークンを、最大この量まで受け入れる」という宣言である。',
      '出すのは受け取る側であって、発行体ではない。発行体が勝手に相手の信用線を作ることはできない。ここが「同意が先、通貨は後」という順序の実装になっている。',
      '`value` を 0 にすれば信用線を閉じられる (残高が 0 のときのみ)。閉じれば owner reserve の 0.2 XRP が戻ってくる。',
    ],
    related: ['trustline', 'iou', 'reserve'],
  },
  {
    id: 'accountset',
    term: 'AccountSet',
    reading: 'あかうんとせっと',
    category: 'tx',
    plainTerm: '口座の設定を変える命令（AccountSet）',
    plain: '口座の設定を変える命令。② で使う。',
    short: '口座の設定を変えるトランザクション。デモでは発行体フラグを立てるのに使う。',
    long: [
      '`SetFlag` に立てたいフラグを指定する。デモの ② では `asfDefaultRipple` を指定して、蔵元を発行体として振る舞えるようにしている。',
      '他にも、送金手数料の設定、鍵の無効化、ドメイン名の紐付けなど、口座まわりの設定はすべてこのトランザクションで行う。',
    ],
    related: ['defaultripple', 'issuer', 'multisig'],
  },
  {
    id: 'autofill',
    term: 'autofill',
    reading: 'おーとふぃる',
    aliases: ['オートフィル'],
    category: 'tx',
    plainTerm: '定型項目の自動入力（autofill）',
    plain: '手数料や順番など、毎回同じように書く項目を自動で埋めてくれる機能。',
    short: '`Fee` `Sequence` `LastLedgerSequence` を自動で埋めるオプション。',
    long: [
      'トランザクションには定型のフィールドがいくつかある。現在の手数料相場、その口座の次の連番 (`Sequence`)、いつまでに載らなければ無効とするかの期限 (`LastLedgerSequence`)。これらを毎回自分で取ってくるのは面倒なので、ライブラリが埋めてくれる。',
      '`{ autofill: true, wallet }` の一行がそれ。裏では台帳への問い合わせが走っている。',
    ],
    related: ['fee', 'submitandwait', 'sequence'],
  },
  {
    id: 'sequence',
    term: 'Sequence',
    reading: 'しーけんす',
    aliases: ['連番'],
    category: 'tx',
    plainTerm: '命令の通し番号（Sequence）',
    plain: 'その口座が出した命令の通し番号。同じ命令が 2 回実行されるのを防ぐ。',
    short: '口座ごとの通し番号。同じ番号のトランザクションは二度実行されない。',
    long: [
      '1 つの口座が出すトランザクションは 1, 2, 3... と順番に番号が振られ、この順にしか実行されない。同じ操作が二重に実行されることを防ぐ仕組みである。',
      '飛び番になると、間が埋まるまで後続は待たされる。並行して複数のトランザクションを投げるときにここが問題になるが、デモは 1 本ずつ順に投げているので気にしなくてよい。',
    ],
    related: ['autofill', 'transaction'],
  },
  {
    id: 'submitandwait',
    term: 'submitAndWait',
    reading: 'さぶみっとあんどうぇいと',
    category: 'tx',
    plainTerm: '送って確定を待つ（submitAndWait）',
    plain: '送って、記録帳に載るまで待つ命令。これが返ってきたら、その取引は終わっている。',
    short: '署名して投げ、検証済みレジャーに載るまで待つ関数。',
    long: [
      '`submit` だけなら投げっぱなしで戻ってくるが、`submitAndWait` は結果が確定するまで待つ。この関数が返ってきたということは、そのレジャーが 80% 超の合意で閉じたということである。',
      '返り値の `meta.TransactionResult` に `tesSUCCESS` などの結果コードが入っている。ここを見ずに「例外が出なかったから成功」と判断すると、`tec` 系の失敗を見落とす。',
    ],
    related: ['finality', 'tessuccess', 'autofill', 'tec'],
  },

  // ── DEX と取引 ──────────────────────────────────────────────
  {
    id: 'dex',
    term: 'DEX',
    reading: 'でっくす',
    aliases: ['分散型取引所', 'decentralized exchange', 'ネイティブ DEX'],
    category: 'dex',
    plainTerm: '取引所（DEX）',
    plain: '取引所。XRPL では最初から記録帳の中にあるので、プログラムを作らなくても使える。',
    short: '仲介業者を通さず台帳上で直接売買する仕組み。XRPL では 2012 年からプロトコルの一次機能。',
    long: [
      'Ethereum で分散型取引所を作るには、スマートコントラクトを書き、監査を受け、デプロイし、gas を払う必要がある。XRPL では `OfferCreate` を 1 本投げるだけで板に注文が載る。デプロイするコントラクトも、gas 見積もりも、監査の予算も無い。',
      '取引所が後付けのアプリケーションではなく、最初からプロトコルに内蔵されているということ。だから板を読むのも `book_offers` という台帳への問い合わせ 1 回で済む。「コントラクトを読む」のではない。',
      '堂島の米会所が、切手の発行とは独立した別の場所ではなく、同じ制度の一部として機能していたのに近い。',
    ],
    related: ['offercreate', 'orderbook', 'amm', 'bookoffers'],
  },
  {
    id: 'orderbook',
    term: 'オーダーブック',
    reading: 'おーだーぶっく',
    aliases: ['order book', '板', '注文板'],
    category: 'dex',
    plainTerm: '注文の掲示板（オーダーブック）',
    plain: '売りたい人と買いたい人の貼り紙が並んだ掲示板。条件が合うと自動で取引が成立する。',
    short: '売り注文と買い注文が価格順に並んだ帳簿。条件が合えば自動的に約定する。',
    long: [
      '「40 石を 8 XRP で売りたい」という注文が並んでいて、そこへ「5 XRP 払って 25 石買いたい」という反対向きの注文が来ると、価格が折り合う範囲で自動的に交差する。',
      'XRPL では通貨ペアごとに板があり、`KOK/XRP` の板と `USD/XRP` の板は別物である。デモの画面に出ている表がまさに `book_offers` の生の結果。',
    ],
    related: ['offercreate', 'takergets', 'fill', 'dex'],
  },
  {
    id: 'offercreate',
    term: 'OfferCreate',
    reading: 'おふぁーくりえいと',
    aliases: ['売り注文', '注文を出す'],
    category: 'dex',
    plainTerm: '注文を 1 枚出す命令（OfferCreate）',
    plain: '掲示板に貼り紙を 1 枚出す命令。',
    short: '板に注文を 1 本置くトランザクション。既存の注文と交差すればその場で約定する。',
    long: [
      '出した瞬間に反対側の注文と価格が合えば、その場で約定して残りが板に載る。合わなければ全量が板に残る。「注文を出す」と「取引する」が別の操作ではない。',
      '板に残った注文は owner reserve 0.2 XRP の対象になる。取り消せば戻る。',
      '注文の向きは `TakerGets` と `TakerPays` で表現するが、この 2 つが最も間違えやすい。',
    ],
    related: ['takergets', 'orderbook', 'fill', 'reserve'],
  },
  {
    id: 'takergets',
    term: 'TakerGets / TakerPays',
    reading: 'ていかーげっつ',
    aliases: ['TakerGets', 'TakerPays'],
    category: 'dex',
    plainTerm: '注文の向きの書き方（TakerGets / TakerPays）',
    plain: '注文の中身。「相手から見た書き方」なので向きを間違えやすい。TakerGets が自分の売るもの。',
    short: '注文の中身。**取る側 (相手) から見た** 表記なのが混乱の元。',
    long: [
      '主語が自分ではなく「板から注文を取る相手 (taker)」である。だから `TakerGets` は相手が受け取るもの = 自分が渡すもの、`TakerPays` は相手が払うもの = 自分が受け取るもの、になる。',
      '例: `TakerGets: 40 KOK` / `TakerPays: 8 XRP` は「相手が 40 KOK を得て 8 XRP を払う」、つまり自分は 40 KOK を 8 XRP で売る、という意味。',
      '覚え方としては「`TakerGets` = 自分が売るもの」で十分。取り違えると、意図と正反対の注文が板に載る。しかもエラーにはならず、そのまま成立してしまうので気づきにくい。',
    ],
    related: ['offercreate', 'orderbook', 'drops'],
  },
  {
    id: 'fill',
    term: '約定',
    reading: 'やくじょう',
    aliases: ['部分約定', 'fill'],
    category: 'dex',
    plainTerm: '取引が成立すること（約定）',
    plain: '注文どうしが合って取引が成立すること。一部だけ成立することもある。',
    short: '注文どうしが交差して取引が成立すること。全部でなく一部だけ成立することもある。',
    long: [
      'デモの ⑥ はわざと板を全部は食わない。藩が 40 石を出しているところへ米仲買が 25 石ぶんだけ買いに行くので、米仲買の注文は使い切られて消え、藩の注文は残り 15 石が板に残る。これが部分約定である。',
      '約定は原子的に起きる。「XRP を渡す」と「トークンを受け取る」は同一トランザクションの中の出来事で、片方だけ起きることはない。取引所に資産を預ける必要が無いのはこのため。',
    ],
    related: ['orderbook', 'offercreate', 'transaction'],
  },
  {
    id: 'amm',
    term: 'AMM',
    reading: 'えーえむえむ',
    aliases: ['自動マーケットメイカー', 'Automated Market Maker'],
    category: 'dex',
    plainTerm: 'プールで両替する仕組み（AMM）',
    plain: '相手がいなくても交換できるように、お金をプールに貯めておく仕組み。',
    short: '注文板ではなく資産プールで価格を決める仕組み。XRPL では板と共存している。',
    long: [
      '板に注文を出す相手がいなくても取引できるように、資産のプールを置いて数式で価格を決める方式。Uniswap が広めた。',
      'XRPL では `AMM` というアムンドメント (XLS-30) として 2024 年 3 月 22 日に有効化され、既存のオーダーブックと同居している。経路探索は両方を見て、安いほうを使う経路を返してくる。',
    ],
    related: ['dex', 'orderbook', 'amendment', 'pathfinding'],
  },
  {
    id: 'pathfinding',
    term: '経路探索',
    reading: 'けいろたんさく',
    aliases: ['path finding', 'ripple_path_find', 'Paths'],
    category: 'dex',
    plainTerm: '届け方を記録帳に聞く（経路探索）',
    plain: '「A を B に変えて届けるには、どう回ればいいか」を記録帳に聞く機能。',
    short: '「この資産を届けるには何を出せばよいか」を台帳自身に聞く機能。',
    long: [
      '送金者が持っていない通貨でも、板を経由すれば届けられることがある。`ripple_path_find` は「UBC → XRP → KRW」のような経路を、それぞれの費用とともに返してくる。',
      '見つかった経路を `Payment` の `Paths` に載せると、複数ホップがまとめて 1 つのトランザクションとして原子的に決済される。途中で止まることがない。',
      'クロスカレンシー送金がプロトコル機能として存在するということで、「日本円を出してカナダドルが届く」のような送金がアプリを書かずに実現できる。板の状態が変われば答えも変わるので、デモの ⑦ は実行のたびに違う結果になりうる。',
    ],
    related: ['payment', 'dex', 'rippling', 'amm'],
  },

  // ── 結果コード ──────────────────────────────────────────────
  {
    id: 'tessuccess',
    term: 'tesSUCCESS',
    reading: 'てすさくせす',
    category: 'result',
    plainTerm: '成功（tesSUCCESS）',
    plain: '成功。これが出たら取引は終わっていて、もう取り消されない。',
    short: '成功。検証済みレジャーに適用され、結果は確定している。',
    long: [
      '`tes` 系は成功を表す接頭辞で、実際には `tesSUCCESS` の 1 つしかない。',
      '注意すべきは、いつ最終になるかである。`submit` がその場で返す `tesSUCCESS` は**暫定の結果**で、サーバが手元の未確定レジャーに適用してみた、という意味しかない。最終になるのは、そのトランザクションが**検証済み (validated) レジャーに含まれた時点**である。',
      'このデモが使っている `submitAndWait` は検証済みになるまで待ってから返すので、画面に出る `tesSUCCESS` は最終と考えてよい。自分で書くときは `LastLedgerSequence` を付け、`validated` を確認してから完了扱いにすること。',
    ],
    related: ['finality', 'submitandwait', 'tec'],
  },
  {
    id: 'tec',
    term: 'tec 系エラー',
    reading: 'てっくけいえらー',
    aliases: ['tec'],
    category: 'result',
    plainTerm: '実行してみての失敗（tec 系）',
    plain: '失敗。ただし「失敗した」という記録は残り、手数料も取られる。',
    short: '失敗。ただし台帳には載り、手数料も消費される。',
    long: [
      '「実行してみたが、条件を満たさなかった」という失敗。形式は正しかったので台帳に記録され、手数料は取られる。失敗したという事実が公開の記録として残る。',
      'エラーコードは必ず読むこと。`tecPATH_DRY` (届ける経路が無い)、`tecUNFUNDED_PAYMENT` (残高不足) など、名前が原因をそのまま説明している。',
      '台帳に載る結果は `tes` と `tec` の 2 つだけである。`tem` `tef` `ter` `tel` はいずれも載らない。',
    ],
    related: ['tem', 'tecpathdry', 'fee', 'tessuccess'],
  },
  {
    id: 'tem',
    term: 'tem 系エラー',
    reading: 'てむけいえらー',
    aliases: ['tem'],
    category: 'result',
    plainTerm: '書き方の誤り（tem 系）',
    plain: '書き方が間違っている。記録帳に届く前に弾かれるので、手数料はかからない。',
    short: '形式不正。そもそも台帳に載らないので、手数料もかからない。',
    long: [
      'フィールドの綴り間違い、金額の書き方の誤り、必須項目の欠落など、トランザクションとして成立していない場合に返る。台帳に届く前に弾かれるため、記録も残らないし手数料も取られない。',
      '`tec` との違いは重要である。`tem` は「書き方が間違っている」、`tec` は「書き方は正しいが状況が合わない」。前者はコードを直し、後者は台帳の状態を確認する。',
      '台帳に載らない結果は `tem` だけではない。`tef` (適用できない)、`ter` (あとで再試行できる)、`tel` (サーバ側のローカルな事情) も同様に載らず、手数料もかからない。',
    ],
    related: ['tec', 'amount'],
  },
  {
    id: 'tecpathdry',
    term: 'tecPATH_DRY',
    reading: 'てっくぱすどらい',
    category: 'result',
    plainTerm: '届ける道がない（tecPATH_DRY）',
    plain: '「届ける道がない」というエラー。送金でだけ出る。',
    short: '`Payment` で資産を届ける経路が無い。板の注文 (`OfferCreate`) では返らない。',
    long: [
      '「届けようとしたが道が無かった」という失敗。受け手に信用線が無い、発行体に `DefaultRipple` が無い、信用線の limit を超える、経路上に十分な流動性が無い、といった原因で返る。',
      '大事なのは、これが `Payment` 側のエラーだということ。`OfferCreate` の公式なエラー一覧に `tecPATH_DRY` は含まれておらず、板の約定は rippling の制約を受けない。Testnet で実測しても、`DefaultRipple` の無い状態で板の約定は `tesSUCCESS` になり、保有者どうしの `Payment` だけが `tecPATH_DRY` になった。',
      '`tec` 系なので台帳に記録され、手数料も焼却される。失敗しても「失敗した」という事実が残る。',
    ],
    related: ['defaultripple', 'tec', 'rippling', 'trustline'],
  },

  // ── API とライブラリ ────────────────────────────────────────
  {
    id: 'xrpljs',
    term: 'xrpl.js',
    reading: 'えっくすあーるぴーえるじぇいえす',
    category: 'api',
    plain: 'JavaScript から XRPL を操作するための公式の道具。',
    short: '公式の JavaScript ライブラリ。ブラウザでも Node.js でも動く。',
    long: [
      '`Client` で台帳につなぎ、`Wallet` で鍵を扱い、`submitAndWait` で投げる。デモが使っているのはほぼこれだけである。',
      '3 行で台帳につながる: `const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")` して `await client.connect()`。サーバは要らない。ブラウザから直接 WebSocket でつなぐ。',
    ],
    related: ['rippled', 'wallet', 'submitandwait'],
    href: 'https://js.xrpl.org/',
  },
  {
    id: 'rippled',
    term: 'rippled',
    reading: 'りっぷるでぃー',
    aliases: ['XRPL サーバ'],
    category: 'api',
    plainTerm: 'XRPL のサーバ本体（rippled）',
    plain: 'XRPL のサーバ本体。ここに問い合わせて記録帳を読む。',
    short: 'XRPL のサーバ実装。WebSocket か JSON-RPC で問い合わせる。',
    long: [
      '台帳の全状態を保持し、トランザクションを受け付け、合意形成に参加する (投票モードなら validator になる)。C++ で書かれたオープンソース。',
      'このデモがつないでいる `wss://s.altnet.rippletest.net:51233` は、公開されている Testnet の rippled である。API はすべてここに直接投げている。',
    ],
    related: ['validator', 'xrpljs', 'testnet'],
  },
  {
    id: 'accountinfo',
    term: 'account_info',
    reading: 'あかうんといんふぉ',
    category: 'api',
    plainTerm: '残高を聞く命令（account_info）',
    plain: '「この口座に XRP がいくらある?」と聞く命令。',
    short: '口座の XRP 残高・連番・OwnerCount を返す問い合わせ。',
    long: [
      '未 fund の口座に対しては `actNotFound` が返る。口座が存在しないからで、これは異常ではない。デモではこれを 0 として扱っている。',
      '`ledger_index: "validated"` を付けると、確定済みのレジャーだけを見る。付けないと、まだ確定していない状態を読んでしまうことがある。',
    ],
    related: ['ownercount', 'reserve', 'rippled'],
  },
  {
    id: 'accountlines',
    term: 'account_lines',
    reading: 'あかうんとらいんず',
    category: 'api',
    plainTerm: '持っているトークンを聞く命令（account_lines）',
    plain: '「この口座はどのトークンをいくら持っている?」と聞く命令。',
    short: 'その口座の信用線とトークン残高の一覧を返す問い合わせ。',
    long: [
      'トークンの残高は必ず発行体とセットで返る。XRP と違い、IOU は「どの発行体の負債か」まで含めて 1 つの資産だからである。',
      '発行体自身に対して呼ぶと、保有者ごとに 1 行ずつ、負の残高が返ってくる。負債を負っている側だからで、デモの蔵元の残高表示が複数行になるのはこのため。',
    ],
    related: ['trustline', 'iou', 'issuer'],
  },
  {
    id: 'bookoffers',
    term: 'book_offers',
    reading: 'ぶっくおふぁーず',
    category: 'api',
    plainTerm: '掲示板の中身を聞く命令（book_offers）',
    plain: '「掲示板にいまどんな貼り紙がある?」と聞く命令。',
    short: '板の注文を読む問い合わせ。コントラクトを読むのではない。',
    long: [
      '通貨ペアを指定すると、その板に並んでいる注文が価格順に返ってくる。台帳への素の問い合わせ 1 回で済む。',
      'DEX がプロトコルの一次機能であることが、この API の素朴さに表れている。どこかにデプロイされたコントラクトのアドレスを知る必要も、ABI を用意する必要も無い。',
    ],
    related: ['dex', 'orderbook', 'rippled'],
  },
];

// ── 索引 ────────────────────────────────────────────────────────

export const BY_ID: Record<string, GlossaryEntry> = Object.fromEntries(
  GLOSSARY.map((e) => [e.id, e]),
);

export function getTerm(id: string): GlossaryEntry | undefined {
  return BY_ID[id];
}

/**
 * 本文の自動リンクに使う照合表。
 *
 * 長い表記から順に試す。「トラストライン」より先に「トラスト」がマッチすると
 * 語の途中で切れてしまうため、順序が意味を持つ。
 */
export const MATCHERS: Array<{ text: string; id: string }> = GLOSSARY.flatMap((e) => [
  { text: e.term, id: e.id },
  ...(e.aliases ?? []).map((a) => ({ text: a, id: e.id })),
]).sort((a, b) => b.text.length - a.text.length);

/** 検索。表記・読み・別表記・一行定義を対象にする */
export function searchGlossary(query: string): GlossaryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return GLOSSARY;
  return GLOSSARY.filter((e) =>
    [e.term, e.reading ?? '', ...(e.aliases ?? []), e.short, ...e.long]
      .join(' ')
      .toLowerCase()
      .includes(q),
  );
}
