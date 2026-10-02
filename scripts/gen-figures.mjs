/**
 * 手描き風の図を roughjs で生成し、SVG のパスとラベル位置を TypeScript として書き出す。
 *
 *   node scripts/gen-figures.mjs
 *
 * 生成物は src/samples/minisig/components/figures/shapes.ts。
 * 文字はここでは埋めない。多言語化のため、React 側でラベルを差し込む。
 * seed を固定しているので、再生成しても差分が出ない。
 */
import rough from 'roughjs';
import { writeFileSync, mkdirSync } from 'fs';

const gen = rough.generator();

const STROKE = { stroke: '#000', strokeWidth: 1.6, roughness: 1.5, bowing: 1.6 };
const seeded = (seed, extra = {}) => ({ ...STROKE, seed, ...extra });

/**
 * roughjs の描画オブジェクトを path の配列にする。
 *
 * 注意: toPaths() は strokeLineDash を返さない。破線にしたい場合は
 * ここで dash を明示的に付ける。読み取りに頼ると実線になる（一度なった）。
 */
const toPaths = (drawable, dash) =>
  gen.toPaths(drawable).map((p) => (dash ? { d: p.d, dash } : { d: p.d }));

/** 角丸を使わない素朴な箱 */
const box = (x, y, w, h, seed) => toPaths(gen.rectangle(x, y, w, h, seeded(seed)));

/** 矢印（線＋先端の2本） */
const arrow = (x1, y1, x2, y2, seed) => {
  const paths = toPaths(gen.line(x1, y1, x2, y2, seeded(seed)));
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const len = 9;
  for (const d of [-0.5, 0.5]) {
    paths.push(
      ...toPaths(
        gen.line(
          x2,
          y2,
          x2 - len * Math.cos(ang + d),
          y2 - len * Math.sin(ang + d),
          seeded(seed + 1)
        )
      )
    );
  }
  return paths;
};

const DASH = [8, 6];
const dashed = (x, y, w, h, seed) =>
  toPaths(gen.rectangle(x, y, w, h, seeded(seed, { strokeWidth: 1.2 })), DASH);

// ---------------------------------------------------------------- figure 1
// 2段構えの送金: あなた → MiniSig → 宛先
// 「宛先はどこ？」「value=0 なのに ETH が動く」への答え。
const twoHop = (() => {
  const W = 760,
    H = 210;
  const bw = 170,
    bh = 66,
    by = 40;
  const x1 = 10,
    x2 = 295,
    x3 = 580;
  return {
    width: W,
    height: H,
    paths: [
      ...box(x1, by, bw, bh, 11),
      ...box(x2, by, bw, bh, 12),
      ...box(x3, by, bw, bh, 13),
      ...arrow(x1 + bw + 6, by + bh / 2, x2 - 8, by + bh / 2, 21),
      ...arrow(x2 + bw + 6, by + bh / 2, x3 - 8, by + bh / 2, 23),
    ],
    // ラベルの差し込み位置。テキストは React 側から渡す
    anchors: {
      a: { x: x1 + bw / 2, y: by + bh / 2 + 5, anchor: 'middle' },
      b: { x: x2 + bw / 2, y: by + bh / 2 + 5, anchor: 'middle' },
      c: { x: x3 + bw / 2, y: by + bh / 2 + 5, anchor: 'middle' },
      step1: { x: (x1 + bw + x2) / 2, y: by - 14, anchor: 'middle' },
      step1b: { x: (x1 + bw + x2) / 2, y: by + bh + 24, anchor: 'middle' },
      step2: { x: (x2 + bw + x3) / 2, y: by - 14, anchor: 'middle' },
      step2b: { x: (x2 + bw + x3) / 2, y: by + bh + 24, anchor: 'middle' },
      note: { x: x2 + bw / 2, y: by + bh + 62, anchor: 'middle' },
    },
  };
})();

// ---------------------------------------------------------------- figure 2
// 閾値: 鍵3本のうち2本そろってはじめて金庫が開く
const threshold = (() => {
  const W = 700,
    H = 250;
  const kx = 30,
    ky = [30, 100, 170];
  const kw = 200,
    kh = 52;
  const vx = 430,
    vy = 70,
    vw = 240,
    vh = 110;
  const paths = [
    ...box(kx, ky[0], kw, kh, 31),
    ...box(kx, ky[1], kw, kh, 32),
    ...box(kx, ky[2], kw, kh, 33),
    ...box(vx, vy, vw, vh, 34),
    // 署名した2本だけが金庫につながる
    ...arrow(kx + kw + 6, ky[0] + kh / 2, vx - 8, vy + 34, 41),
    ...arrow(kx + kw + 6, ky[1] + kh / 2, vx - 8, vy + 66, 43),
  ];
  // 3本目は届かない（短い破線）
  paths.push(
    ...toPaths(gen.line(kx + kw + 6, ky[2] + kh / 2, kx + kw + 90, ky[2] + kh / 2, seeded(45)), [6, 6])
  );
  return {
    width: W,
    height: H,
    paths,
    anchors: {
      k1: { x: kx + kw / 2, y: ky[0] + kh / 2 + 5, anchor: 'middle' },
      k2: { x: kx + kw / 2, y: ky[1] + kh / 2 + 5, anchor: 'middle' },
      k3: { x: kx + kw / 2, y: ky[2] + kh / 2 + 5, anchor: 'middle' },
      vault: { x: vx + vw / 2, y: vy + vh / 2 - 6, anchor: 'middle' },
      vaultSub: { x: vx + vw / 2, y: vy + vh / 2 + 20, anchor: 'middle' },
      cut: { x: kx + kw + 100, y: ky[2] + kh / 2 + 5, anchor: 'start' },
    },
  };
})();

// ---------------------------------------------------------------- figure 3
// 署名を集めるのはチェーンの外。チェーンは最後の1回しか見ない。
const offChain = (() => {
  const W = 760,
    H = 260;
  const ox = 10,
    oy = 34,
    ow = 430,
    oh = 190;
  const cx = 500,
    cy = 34,
    cw = 250,
    ch = 190;
  const sw = 350,
    sh = 40,
    sx = ox + 40;
  const rows = [oy + 40, oy + 92, oy + 144];
  return {
    width: W,
    height: H,
    paths: [
      ...dashed(ox, oy, ow, oh, 51),
      ...dashed(cx, cy, cw, ch, 52),
      ...box(sx, rows[0], sw - 40, sh, 53),
      ...box(sx, rows[1], sw - 40, sh, 54),
      ...box(sx, rows[2], sw - 40, sh, 55),
      ...arrow(ox + ow + 4, oy + oh / 2, cx - 6, cy + ch / 2, 61),
    ],
    anchors: {
      offTitle: { x: ox + 12, y: oy - 10, anchor: 'start' },
      chainTitle: { x: cx + 12, y: cy - 10, anchor: 'start' },
      r1: { x: sx + 14, y: rows[0] + 26, anchor: 'start' },
      r2: { x: sx + 14, y: rows[1] + 26, anchor: 'start' },
      r3: { x: sx + 14, y: rows[2] + 26, anchor: 'start' },
      chainBody: { x: cx + cw / 2, y: cy + ch / 2 - 4, anchor: 'middle' },
      chainSub: { x: cx + cw / 2, y: cy + ch / 2 + 24, anchor: 'middle' },
    },
  };
})();

// --------------------------------------------------------------- emit
mkdirSync('src/samples/minisig/components/figures', { recursive: true });

const body = `// 自動生成。編集しないこと。
// 生成: node scripts/gen-figures.mjs  (roughjs, seed 固定)
//
// 文字はここに含めない。多言語化のため React 側でラベルを差し込む。

export type Anchor = { x: number; y: number; anchor: 'start' | 'middle' | 'end' };
export type Stroke = { d: string; dash?: number[] };
export type Figure = {
  width: number;
  height: number;
  paths: Stroke[];
  anchors: Record<string, Anchor>;
};

export const twoHop: Figure = ${JSON.stringify(twoHop, null, 2)};

export const threshold: Figure = ${JSON.stringify(threshold, null, 2)};

export const offChain: Figure = ${JSON.stringify(offChain, null, 2)};
`;

writeFileSync('src/samples/minisig/components/figures/shapes.ts', body);
console.log(
  'wrote src/samples/minisig/components/figures/shapes.ts',
  `(twoHop ${twoHop.paths.length} paths, threshold ${threshold.paths.length}, offChain ${offChain.paths.length})`
);
