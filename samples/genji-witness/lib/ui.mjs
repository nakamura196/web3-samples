/** 端末表示の小道具。依存なし */
export const c = {
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  ng: (s) => `\x1b[31m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`,
};

export const rule = (title) => {
  const bar = '━'.repeat(72);
  console.log(`\n${c.b(bar)}\n${c.b(title)}\n${c.b(bar)}`);
};

export const head = (title) => console.log(`\n${c.b(title)}`);

/** --name=value を読む */
export const argOf = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;

/** 先頭の位置引数 (--つきを除く) */
export const positional = (n = 0) => process.argv.slice(2).filter((a) => !a.startsWith('--'))[n];

/** 全角を 2 桁と数えて幅を揃える */
export function padTo(s, width) {
  const w = [...String(s)].reduce((n, ch) => n + (/[　-鿿＀-￯]/.test(ch) ? 2 : 1), 0);
  return String(s) + ' '.repeat(Math.max(0, width - w));
}
