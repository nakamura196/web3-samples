/**
 * 図。
 *
 * 方針は 4 つ。
 *  - 1 枚の図はひとつの関係だけを示す。盛り込むと何も言わなくなる
 *  - 矢印には必ずラベルを付ける。無記名の矢印は「なんか関係がある」でしかない
 *  - 色だけに意味を持たせない。◯ ✕ と語で二重に示す
 *  - <figure> + <figcaption> + role="img" + aria-label。読み上げでも同じことが伝わるように
 *
 * 依存は増やさない。roughjs のような作図ライブラリは使わず、素の SVG を手で書く。
 * 配色はページの CSS 変数を引くので、明暗どちらのテーマでも読める。
 */

import type { ReactNode } from 'react';

const INK = 'currentColor';
const ACCENT = 'var(--accent)';
const SOFT = 'var(--ink-soft)';

function Figure({
  id,
  label,
  caption,
  viewBox,
  children,
}: {
  /** 同一ページに複数置くので、marker の id が衝突しないよう前置きする */
  id: string;
  /** 図が示している主張。読み上げにもこれが渡る */
  label: string;
  caption: ReactNode;
  viewBox: string;
  children: ReactNode;
}) {
  return (
    <figure className="my-5">
      <svg
        viewBox={viewBox}
        role="img"
        aria-label={label}
        className="block h-auto w-full text-ink"
      >
        <defs>
          <marker
            id={`${id}-arrow`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={INK} />
          </marker>
          <marker
            id={`${id}-arrow-accent`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={ACCENT} />
          </marker>
        </defs>
        {children}
      </svg>
      <figcaption className="mt-2 text-[11px] leading-relaxed text-ink-soft">{caption}</figcaption>
    </figure>
  );
}

/** 登場人物の箱 */
function Box({
  x,
  y,
  w,
  h,
  title,
  sub,
  accent = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="6"
        fill="var(--surface-2)"
        stroke={accent ? ACCENT : 'var(--border)'}
        strokeWidth={accent ? 2 : 1.5}
      />
      <text
        x={x + w / 2}
        y={sub ? y + h / 2 - 7 : y + h / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="13"
        fontWeight="600"
        fill={accent ? ACCENT : INK}
      >
        {title}
      </text>
      {sub && (
        <text
          x={x + w / 2}
          y={y + h / 2 + 10}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="10.5"
          fill={SOFT}
        >
          {sub}
        </text>
      )}
    </g>
  );
}

/** ラベル付きの矢印 */
function Arrow({
  id,
  from,
  to,
  label,
  sub,
  accent = false,
  dashed = false,
  below = false,
}: {
  id: string;
  from: [number, number];
  to: [number, number];
  label?: string;
  sub?: string;
  accent?: boolean;
  dashed?: boolean;
  /** ラベルを線の下に置く */
  below?: boolean;
}) {
  const mx = (from[0] + to[0]) / 2;
  const my = (from[1] + to[1]) / 2;
  return (
    <g>
      <line
        x1={from[0]}
        y1={from[1]}
        x2={to[0]}
        y2={to[1]}
        stroke={accent ? ACCENT : INK}
        strokeWidth="1.6"
        strokeDasharray={dashed ? '5 4' : undefined}
        markerEnd={`url(#${id}-arrow${accent ? '-accent' : ''})`}
      />
      {label && (
        <text
          x={mx}
          y={below ? my + 16 : my - 8}
          textAnchor="middle"
          fontSize="11.5"
          fill={accent ? ACCENT : INK}
        >
          {label}
        </text>
      )}
      {sub && (
        <text x={mx} y={below ? my + 29 : my + 13} textAnchor="middle" fontSize="10" fill={SOFT}>
          {sub}
        </text>
      )}
    </g>
  );
}

/** ◯ / ✕ の印。色だけに頼らず記号と語で示す */
function Mark({ x, y, ok, text }: { x: number; y: number; ok: boolean; text: string }) {
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r="10"
        fill="none"
        stroke={ok ? 'var(--ok)' : 'var(--err)'}
        strokeWidth="1.8"
      />
      <text
        x={x}
        y={y + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="12"
        fontWeight="700"
        fill={ok ? 'var(--ok)' : 'var(--err)'}
      >
        {ok ? '◯' : '✕'}
      </text>
      <text x={x + 16} y={y + 1} dominantBaseline="middle" fontSize="11" fill={ok ? 'var(--ok)' : 'var(--err)'}>
        {text}
      </text>
    </g>
  );
}

// ── 1. 米切手は誰に渡るのか ────────────────────────────────────

export function FigRiceNoteFlow() {
  const id = 'fig-flow';
  return (
    <Figure
      id={id}
      viewBox="0 0 780 210"
      label="藩は米を蔵屋敷に納めるが、米切手は代金を払った米仲買に渡る。藩は切手を受け取らない。"
      caption="紙は「米を出した側」ではなく「代金を払った側」に渡る。ここが直感と逆になりやすい。"
    >
      <Box x={10} y={40} w={100} h={56} title="藩" sub="米を出す" />
      <Box x={200} y={40} w={120} h={56} title="蔵屋敷" sub="発行する" accent />
      <Box x={410} y={40} w={130} h={56} title="米仲買 A" sub="代金を払う" />
      <Box x={630} y={40} w={130} h={56} title="米仲買 B" sub="市場で買う" />

      <Arrow id={id} from={[110, 68]} to={[198, 68]} label="米を納める" />
      <Arrow id={id} from={[320, 68]} to={[408, 68]} label="米切手" accent />
      <Arrow id={id} from={[540, 68]} to={[628, 68]} label="堂島で転売" />

      <path
        d="M 475 96 L 475 150 L 260 150 L 260 98"
        fill="none"
        stroke={INK}
        strokeWidth="1.6"
        markerEnd={`url(#${id}-arrow)`}
      />
      <text x={367} y={166} textAnchor="middle" fontSize="11.5" fill={INK}>
        代金を払う（掛屋が受け取る）
      </text>

      <text x={60} y={190} textAnchor="middle" fontSize="10.5" fill={SOFT}>
        切手は受け取らない
      </text>
    </Figure>
  );
}

// ── 2. XRP とトークンの違い ────────────────────────────────────

export function FigXrpVsToken() {
  const id = 'fig-xrp';
  return (
    <Figure
      id={id}
      viewBox="0 0 780 250"
      label="XRP は発行体がいないので送り手と受け手だけで完結する。トークンは必ず発行体の負債がぶら下がる。"
      caption="XRP はその 2 者で完結する。トークンは、送っても発行体との関係が消えない。"
    >
      <text x={10} y={20} fontSize="12" fontWeight="600" fill={INK}>
        XRP を送る
      </text>
      <Box x={10} y={40} w={110} h={52} title="送り手" />
      <Box x={230} y={40} w={110} h={52} title="受け手" />
      <Arrow id={id} from={[120, 66]} to={[228, 66]} label="25 XRP" />
      <text x={175} y={120} textAnchor="middle" fontSize="11" fill={SOFT}>
        誰の負債でもない
      </text>
      <text x={175} y={138} textAnchor="middle" fontSize="11" fill={SOFT}>
        事前の同意も要らない
      </text>

      <line x1={390} y1={10} x2={390} y2={240} stroke="var(--border)" strokeWidth="1" />

      <text x={420} y={20} fontSize="12" fontWeight="600" fill={ACCENT}>
        トークンを送る
      </text>
      <Box x={420} y={40} w={110} h={52} title="送り手" />
      <Box x={640} y={40} w={110} h={52} title="受け手" />
      <Arrow id={id} from={[530, 66]} to={[638, 66]} label="100 UBC" accent />

      <Box x={530} y={175} w={110} h={52} title="発行体" accent />
      <path
        d="M 585 172 L 585 82"
        fill="none"
        stroke={ACCENT}
        strokeWidth="1.6"
        strokeDasharray="5 4"
        markerEnd={`url(#${id}-arrow-accent)`}
      />
      <text x={598} y={140} fontSize="11" fill={ACCENT}>
        この人の負債が
      </text>
      <text x={598} y={155} fontSize="11" fill={ACCENT}>
        ずっとぶら下がる
      </text>
      <text x={585} y={247} textAnchor="middle" fontSize="10.5" fill={SOFT}>
        飛べば価値は消える
      </text>
    </Figure>
  );
}

// ── 3. 信用線 — 同意が先 ───────────────────────────────────────

export function FigTrustLine() {
  const id = 'fig-trust';
  return (
    <Figure
      id={id}
      viewBox="0 0 780 230"
      label="同意していない相手にはトークンが届かず tecPATH_DRY で失敗する。先に同意すると届く。"
      caption="順番が逆だと届かない。受け取る側が先に「受け取ります」と言っておく必要がある。"
    >
      <text x={10} y={20} fontSize="12" fontWeight="600" fill={INK}>
        同意していないとき
      </text>
      <Box x={10} y={38} w={110} h={52} title="発行体" />
      <Box x={250} y={38} w={110} h={52} title="受け手" sub="同意なし" />
      <line
        x1={120}
        y1={64}
        x2={248}
        y2={64}
        stroke="var(--err)"
        strokeWidth="1.6"
        strokeDasharray="5 4"
      />
      <line x1={178} y1={52} x2={196} y2={76} stroke="var(--err)" strokeWidth="2" />
      <line x1={196} y1={52} x2={178} y2={76} stroke="var(--err)" strokeWidth="2" />
      <Mark x={24} y={120} ok={false} text="届かない — tecPATH_DRY" />
      <text x={10} y={152} fontSize="10.5" fill={SOFT}>
        失敗も台帳に記録され、手数料は焼かれる
      </text>

      <line x1={400} y1={10} x2={400} y2={220} stroke="var(--border)" strokeWidth="1" />

      <text x={425} y={20} fontSize="12" fontWeight="600" fill={ACCENT}>
        先に同意したとき
      </text>
      <Box x={425} y={38} w={110} h={52} title="発行体" />
      <Box x={655} y={38} w={110} h={52} title="受け手" sub="同意あり" accent />
      <path
        d="M 710 130 L 710 110 L 710 96"
        fill="none"
        stroke={ACCENT}
        strokeWidth="1.6"
        markerEnd={`url(#${id}-arrow-accent)`}
      />
      <text x={710} y={148} textAnchor="middle" fontSize="11" fill={ACCENT}>
        ① TrustSet で同意
      </text>
      <text x={710} y={164} textAnchor="middle" fontSize="10.5" fill={SOFT}>
        「1000 まで受け取る」
      </text>
      <Arrow id={id} from={[535, 64]} to={[653, 64]} label="② 100 UBC" accent />
      <Mark x={439} y={196} ok text="届く" />
    </Figure>
  );
}

// ── 4. TakerGets / TakerPays の向き ────────────────────────────

export function FigTakerDirection() {
  const id = 'fig-taker';
  return (
    <Figure
      id={id}
      viewBox="0 0 780 210"
      label="TakerGets は自分が売るもの、TakerPays は自分が受け取るもの。主語は相手であることに注意。"
      caption="主語が「自分」ではなく「板から注文を取る相手」なので逆に読みやすい。TakerGets が自分の売るもの。"
    >
      <text x={390} y={20} textAnchor="middle" fontSize="12" fontWeight="600" fill={SOFT}>
        自分から見ると
      </text>
      <text x={195} y={48} textAnchor="middle" fontSize="12" fontWeight="600" fill={ACCENT}>
        自分が売る
      </text>
      <text x={585} y={48} textAnchor="middle" fontSize="12" fontWeight="600" fill={ACCENT}>
        自分が受け取る
      </text>

      <line x1={195} y1={56} x2={195} y2={80} stroke={ACCENT} strokeWidth="1.6" markerEnd={`url(#${id}-arrow-accent)`} />
      <line x1={585} y1={56} x2={585} y2={80} stroke={ACCENT} strokeWidth="1.6" markerEnd={`url(#${id}-arrow-accent)`} />

      <rect x={40} y={86} width={310} height={50} rx="6" fill="var(--surface-2)" stroke={ACCENT} strokeWidth="2" />
      <text x={195} y={111} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontFamily="ui-monospace, monospace" fill={INK}>
        TakerGets: 40 KOK
      </text>
      <rect x={430} y={86} width={310} height={50} rx="6" fill="var(--surface-2)" stroke="var(--border)" strokeWidth="1.5" />
      <text x={585} y={111} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontFamily="ui-monospace, monospace" fill={INK}>
        TakerPays: 8 XRP
      </text>

      <line x1={195} y1={142} x2={195} y2={166} stroke={INK} strokeWidth="1.6" markerEnd={`url(#${id}-arrow)`} />
      <line x1={585} y1={142} x2={585} y2={166} stroke={INK} strokeWidth="1.6" markerEnd={`url(#${id}-arrow)`} />
      <text x={195} y={186} textAnchor="middle" fontSize="12" fill={INK}>
        相手が受け取る
      </text>
      <text x={585} y={186} textAnchor="middle" fontSize="12" fill={INK}>
        相手が払う
      </text>
      <text x={390} y={205} textAnchor="middle" fontSize="12" fontWeight="600" fill={SOFT}>
        相手（taker）から見ると — こちらが書き方の基準
      </text>
    </Figure>
  );
}

// ── 5. DefaultRipple — 落ちるのは送金だけ ──────────────────────

export function FigDefaultRipple() {
  const id = 'fig-dr';
  return (
    <Figure
      id={id}
      viewBox="0 0 780 260"
      label="DefaultRipple が無いと保有者どうしの送金は失敗するが、板の約定は成功する。だから設定漏れに気づけない。"
      caption="Testnet で実測した結果。板の約定は発行体を経由しないので通ってしまう。だからデモを最後まで走らせても設定漏れに気づけない。"
    >
      <text x={10} y={18} fontSize="12" fontWeight="600" fill={INK}>
        DefaultRipple を立てていないとき
      </text>

      <Box x={10} y={44} w={110} h={50} title="保有者 A" />
      <Box x={330} y={44} w={110} h={50} title="保有者 B" />
      <Box x={170} y={130} w={110} h={50} title="発行体" accent />
      <path
        d="M 120 69 L 170 69 L 170 128"
        fill="none"
        stroke="var(--err)"
        strokeWidth="1.6"
        strokeDasharray="5 4"
      />
      <path
        d="M 280 155 L 330 155 L 330 96"
        fill="none"
        stroke="var(--err)"
        strokeWidth="1.6"
        strokeDasharray="5 4"
      />
      <line x1={205} y1={95} x2={245} y2={125} stroke="var(--err)" strokeWidth="2.4" />
      <line x1={245} y1={95} x2={205} y2={125} stroke="var(--err)" strokeWidth="2.4" />
      <text x={225} y={200} textAnchor="middle" fontSize="11.5" fill={INK}>
        送金は発行体を経由する
      </text>
      <Mark x={24} y={228} ok={false} text="Payment — tecPATH_DRY で失敗" />

      <line x1={470} y1={10} x2={470} y2={240} stroke="var(--border)" strokeWidth="1" />

      <text x={495} y={18} fontSize="12" fontWeight="600" fill={INK}>
        同じ設定のまま、板で売買すると
      </text>
      <Box x={495} y={44} w={110} h={50} title="保有者 A" />
      <Box x={655} y={44} w={110} h={50} title="保有者 B" />
      <Box x={575} y={130} w={110} h={50} title="板（DEX）" accent />
      <path
        d="M 550 96 L 550 155 L 573 155"
        fill="none"
        stroke={ACCENT}
        strokeWidth="1.6"
        markerEnd={`url(#${id}-arrow-accent)`}
      />
      <path
        d="M 687 128 L 687 110 L 710 110 L 710 96"
        fill="none"
        stroke={ACCENT}
        strokeWidth="1.6"
        markerEnd={`url(#${id}-arrow-accent)`}
      />
      <text x={630} y={200} textAnchor="middle" fontSize="11.5" fill={INK}>
        板は発行体を経由しない
      </text>
      <Mark x={509} y={228} ok text="OfferCreate — tesSUCCESS で成立" />
    </Figure>
  );
}
