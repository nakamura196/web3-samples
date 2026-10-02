import type { Figure as FigureData } from './shapes';

/**
 * 手描き風の図の器。
 *
 * - パスは roughjs で事前生成したもの（scripts/gen-figures.mjs）
 * - 線も文字も `currentColor` なので、ライト/ダークの両方に追従する
 * - 色に意味を持たせない。形と文字だけで読めるようにする
 * - 図が読めなくても内容が伝わるよう、caption を必ず添える
 */
export default function Figure({
  data,
  labels,
  caption,
  emphasis = [],
}: {
  data: FigureData;
  /** anchors のキーごとの文字列。改行は \n で分ける */
  labels: Record<string, string>;
  caption: string;
  /** 太字にしたい anchor のキー */
  emphasis?: string[];
}) {
  return (
    <figure className="my-8">
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-4 text-gray-800 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-100">
        <svg
          viewBox={`0 0 ${data.width} ${data.height}`}
          className="mx-auto block h-auto w-full"
          style={{ maxWidth: data.width }}
          role="img"
          aria-label={caption}
        >
          <g stroke="currentColor" fill="none" strokeLinecap="round">
            {data.paths.map((p, i) => (
              <path key={i} d={p.d} strokeDasharray={p.dash?.join(' ')} />
            ))}
          </g>
          <g fill="currentColor" stroke="none" fontSize={15}>
            {Object.entries(data.anchors).map(([key, a]) => {
              const text = labels[key];
              if (!text) return null;
              const lines = text.split('\n');
              return (
                <text
                  key={key}
                  x={a.x}
                  y={a.y - (lines.length - 1) * 9}
                  textAnchor={a.anchor}
                  fontWeight={emphasis.includes(key) ? 700 : 400}
                >
                  {lines.map((line, i) => (
                    <tspan key={i} x={a.x} dy={i === 0 ? 0 : 18}>
                      {line}
                    </tspan>
                  ))}
                </text>
              );
            })}
          </g>
        </svg>
      </div>
      <figcaption className="mt-2 text-sm text-gray-600 dark:text-gray-400">{caption}</figcaption>
    </figure>
  );
}
