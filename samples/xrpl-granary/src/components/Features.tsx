import { Card, ExtLink } from './ui';

const FEATURES: Array<{ head: string; body: string; href?: string }> = [
  {
    head: 'マイニングをしない合意形成',
    body:
      'validator が候補となるトランザクション集合を提案し、票が割れたものを落としながら投票を重ねる。' +
      '80% を超えた時点でレジャーが閉じる。競争ではなく協調で、消費するのは電力ではなく帯域。',
    href: 'https://xrpl.org/docs/concepts/consensus-protocol',
  },
  {
    head: '3〜5 秒で決定的ファイナリティ',
    body:
      'フォークが起きないので「6 ブロック待つ」に相当する概念がない。tesSUCCESS が返った時点で確定で、' +
      '確率的に確信が上がっていくのではない。2012 年からこの速度で動き続けている。',
  },
  {
    head: 'UNL — 誰の声を聞くかは各サーバが選ぶ',
    body:
      'Unique Node List は「そのサーバが参照する validator の一覧」。学術論文の引用に近く、権威は' +
      '「誰に引かれているか」から生まれる。リストが十分に重なるかぎり、ネットワーク全体が同じ結論に至る。' +
      '現在 validator は 150 以上、既定 UNL に 35、そのうち Ripple が運用するのは 1 つ。',
    href: 'https://xrpl.org/docs/concepts/consensus-protocol',
  },
  {
    head: '発行体は資産の一部',
    body:
      '発行されたトークン (IOU) は発行体の負債として台帳に載る。「X が発行した 100 CAD」と' +
      '「Y が発行した 100 CAD」は別物で、台帳は誰が負っているかを忘れない。' +
      'ステーブルコインもポイントもトークン化資産も、この 1 つの原始的な仕組みの上にある。',
    href: 'https://xrpl.org/docs/concepts/tokens',
  },
  {
    head: '信用線 — 同意なくして残高なし',
    body:
      '発行体のトークンを持つには、受け手が trust line を開いて上限を宣言する必要がある。' +
      '「この発行体のリスクをいくらまで引き受けるか」という与信判断が、アプリ層ではなくプロトコル層にある。',
    href: 'https://xrpl.org/docs/concepts/tokens/fungible-tokens/trust-lines-and-issuing',
  },
  {
    head: 'DEX と AMM がプロトコルの一次機能',
    body:
      'オーダーブックはチェーンの上に乗ったコントラクトではなく、2012 年から支払いと並ぶ組み込み機能 (OfferCreate)。' +
      'のちに AMM プールが並走する形で加わった。デプロイも gas 見積もりも監査予算も要らない。',
    href: 'https://xrpl.org/docs/concepts/tokens/decentralized-exchange',
  },
  {
    head: 'クロス通貨の原子的マルチホップ',
    body:
      '1 つの支払いが複数の通貨と板を経由できる。すべてのホップが成立して決済されるか、まったく起きないかのどちらか。' +
      '送金者が直接触れない通貨を経由する経路も、レジャー自身が探索して返す (ripple_path_find)。',
  },
  {
    head: '準備金 — 台帳を埋立地にしない仕組み',
    body:
      '口座が存在するには base reserve 1 XRP、trust line や注文などのオブジェクト 1 件ごとに owner reserve 0.2 XRP が' +
      'ロックされる。2024 年 12 月の validator による手数料投票で 10 / 2 XRP から引き下げられた。',
    href: 'https://xrpl.org/docs/concepts/accounts/reserves',
  },
  {
    head: '書かずに済む「コントラクト」',
    body:
      'マルチシグ、エスクロー、小切手、Credentials (XLS-70)、Permissioned Domains (XLS-80) などは' +
      'プロトコル機能として提供される。書くコードが無いということは、監査すべき脆弱性も無いということ。',
  },
  {
    head: 'アムンドメントは 80% × 2 週間',
    body:
      '機能追加は validator の 80% の支持が 2 週間続いて初めて有効になる。誰かが一存で仕様を変えることはできず、' +
      '逆に言えば新機能の投入は遅い。v3.3.0 (2026年8月) の Confidential Transfer もまだ投票中。',
  },
];

const TRADEOFFS = [
  '信頼の前提が違う。PoW は電力に、XRPL は「UNL の validator が結託しない」ことに賭けている。安いのは、その賭けを引き受けているから。',
  '汎用スマートコントラクトは無い。できることはプロトコルが用意した範囲で、それを超えるなら EVM サイドチェーンなど別レイヤーに出る。',
  '発行体リスクは消えない。IOU はどこまでいっても発行体の負債で、倉庫が焼ければ受領証も紙になる。台帳が保証するのは「誰が何を負ったか」の記録だけ。',
  '出発点は中央集権だった。2012 年は Ripple がほぼすべての validator を運用していた。分散は状態ではなく方向で、いまも途中にある。',
];

export function Features() {
  return (
    <div className="space-y-6">
      <Card
        title="XRPL の特徴"
        hint="このデモで実際に触った機能を中心に"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.head} className="rounded border border-border bg-surface-2 p-3">
              <h3 className="text-xs font-semibold text-accent">{f.head}</h3>
              <p className="mt-1.5 text-xs leading-relaxed">{f.body}</p>
              {f.href && (
                <p className="mt-1.5 text-[11px]">
                  <ExtLink href={f.href}>xrpl.org →</ExtLink>
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="代わりに何を諦めているか" hint="速さと安さはただではない">
        <ul className="space-y-2 text-xs leading-relaxed">
          {TRADEOFFS.map((t) => (
            <li key={t} className="flex gap-2">
              <span className="text-warn">·</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
