/**
 * xml/master/*.xml から本文行 (`<seg>`) を取り出す。依存パッケージなし。
 *
 * ── 正規化をしない、という判断 ──────────────────────────────────
 * ndl-witness では JSON をキーの辞書順に並べ替えてから digest を取っていた。
 * 相手が **API の応答**だったからで、同じ内容でもキーの順や空白が揺れる。
 *
 * 校異源氏物語で digest を取る相手は **git リポジトリの中のファイル**である。
 * すでに確定したバイト列なので、揺れる余地がない。だから XML の正規化
 * (W3C Canonical XML) は使わず、**ソースのバイト列をそのまま**取る。
 *
 * 正規化が必要かどうかは思想ではなく、相手が API かファイルかで決まる。
 * ここは ndl-witness と条件が違うので、わざと違う方式にしてある。
 *
 * ── 行の葉に何を入れるか ────────────────────────────────────────
 *   corresp の URI + 0x00 + seg の中身 (ソースのバイト列そのまま)
 *
 * URI を一緒に入れるのは、証明したい主張が「この**行番号**の本文はこれだった」で
 * あって「この文字列がどこかにあった」ではないため。区切りに 0x00 を使うのは、
 * URI にも TEI の本文にも NUL が現れないので取り違えが起きないから。
 *
 * seg の中身を**テキストだけに削らない**のも意図的で、和歌 9 首のように
 * `<lg type="waka">` を含む seg がある。どこを和歌と同定したかは校異の判断そのもので、
 * それを落とすと「本文は同じだが同定が違う版」を区別できなくなる。
 *
 * ── 走査器で済ませている理由 ────────────────────────────────────
 * XML の parser を入れると依存が増える。seg は入れ子にならず属性も単純なので、
 * 引用符を見ながら走る 60 行で足りる。**ただし当てにはしない** —
 * scripts/00-selftest.mjs が lxml (リポジトリの build_api.py と同じもの) の
 * 抽出結果と 25,065 件すべてを突き合わせる。
 */
import fs from 'node:fs';
import path from 'node:path';

export const ENTRY_SPEC = 'uri-nul-seg-inner-xml';
export const CORPUS_URI = 'https://w3id.org/kouigenjimonogatari/';

/** 葉に入れるバイト列。URI と本文を 0x00 (NUL) で区切る */
export const itemEntry = (corresp, inner) => Buffer.from(corresp + '\u0000' + inner, 'utf8');

/** 開始タグの終わりを探す。属性値の中の '>' に引っかからないよう引用符を見る */
function endOfStartTag(xml, from) {
  let quote = null;
  for (let i = from; i < xml.length; i++) {
    const ch = xml[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      return i;
    }
  }
  throw new Error(`開始タグが閉じていません (位置 ${from})`);
}

const ATTR = /([A-Za-z_:][\w.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;

function attrsOf(startTag) {
  const out = {};
  for (const m of startTag.matchAll(ATTR)) out[m[1]] = m[3] ?? m[4];
  return out;
}

/**
 * 1 ファイルから seg を取り出す。
 * @returns {{corresp: string, inner: string}[]} ソースに現れる順
 */
export function readSegs(xml, label = '') {
  const out = [];
  let i = 0;
  while (true) {
    const at = xml.indexOf('<seg', i);
    if (at < 0) break;
    // '<segFoo' のような別要素を弾く
    if (!/[\s/>]/.test(xml[at + 4] ?? '')) { i = at + 4; continue; }

    const gt = endOfStartTag(xml, at);
    const startTag = xml.slice(at, gt + 1);
    if (startTag.endsWith('/>')) {
      throw new Error(`${label}: 中身のない <seg/> があります (位置 ${at})。想定していません`);
    }
    const close = xml.indexOf('</seg>', gt + 1);
    if (close < 0) throw new Error(`${label}: </seg> が見つかりません (位置 ${at})`);

    const inner = xml.slice(gt + 1, close);
    if (inner.includes('<seg')) throw new Error(`${label}: seg が入れ子になっています (位置 ${at})`);

    const {corresp} = attrsOf(startTag);
    if (!corresp) throw new Error(`${label}: corresp の無い seg があります (位置 ${at})`);
    out.push({corresp, inner});
    i = close + 6;
  }
  return out;
}

/** xml/master/*.xml を帖の番号順に読む */
export function readCorpus(masterDir) {
  const files = fs.readdirSync(masterDir).filter((f) => /^\d+\.xml$/.test(f))
    .sort((a, b) => Number(a.replace('.xml', '')) - Number(b.replace('.xml', '')));
  if (files.length === 0) throw new Error(`帖が見つかりません: ${masterDir}`);

  return files.map((name) => {
    const file = path.join(masterDir, name);
    const bytes = fs.readFileSync(file);          // digest はこのバイト列に対して取る
    const text = bytes.toString('utf8');
    return {name, file, bytes, segs: readSegs(text, name)};
  });
}

/** 全帖の seg を 1 本に並べ、URI の重複が無いことを確かめる */
export function flattenItems(corpus) {
  const items = [];
  const seen = new Map();
  for (const chapter of corpus) {
    for (const seg of chapter.segs) {
      const dup = seen.get(seg.corresp);
      if (dup) throw new Error(`corresp が重複: ${seg.corresp} (${dup} と ${chapter.name})`);
      seen.set(seg.corresp, chapter.name);
      items.push({chapter: chapter.name, ...seg});
    }
  }
  return items;
}

/**
 * teiHeader から書誌と担当者を読む。**手で書かず、TEI から取る。**
 *
 * ── なぜ必要になったか ──────────────────────────────────────────
 * DDO の author に 'Satoru Nakamura / 中村 覚' と**手で書いていた**。
 * TEI ヘッダを 54 帖すべてで集計したところ、実際にはこうだった:
 *
 *   Transcription   Misa Nakamura / Michi Kigoshi / Takashi Tamura
 *   TEI Encoding    Satoru Nakamura
 *   Advisor         Kiyonori Nagasaki
 *
 * **翻刻は 3 名の仕事で、TEI 化がもう 1 名。** 1 人だけを author にしていたのは
 * 学術資料として不正確である。CC0 でも帰属表示は意味を持つ。
 *
 * ── 手で書かない理由 ────────────────────────────────────────────
 * 手で書くと、TEI が更新されたときに食い違う。二重管理になる。
 * 「画面はチェーンを映す、チェーンは TEI を映す」で一貫させる。
 * 団体名を名乗ることになった場合も、TEI に入れれば自動で追従する。
 *
 * ── 正規表現で読む理由 ──────────────────────────────────────────
 * この試作は依存パッケージゼロを保っている。XML パーサを入れない。
 * 相手は自分たちが書いた TEI で、形が決まっているので、これで足りる。
 * 崩れた入力を食わせる用途ではない。
 */
export function readHeader(xml) {
  const header = xml.slice(0, xml.indexOf('</teiHeader>') + 1);
  const one = (tag) => header.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`))?.[1]?.trim() ?? null;

  // <respStmt><resp when="…">役割</resp><name>氏名</name></respStmt>
  // 1 つの respStmt に name が複数入ることもあるので、resp ごとにまとめる
  const contributors = [];
  for (const m of header.matchAll(/<respStmt[^>]*>([\s\S]*?)<\/respStmt>/g)) {
    const block = m[1];
    const role = block.match(/<resp[^>]*>([^<]*)<\/resp>/)?.[1]?.trim();
    if (!role) continue;
    for (const n of block.matchAll(/<name[^>]*>([^<]*)<\/name>/g)) {
      const name = n[1].trim();
      if (name) contributors.push({ name, role });
    }
  }

  // <sourceDesc><bibl> が底本。publisher はそちらの出版社であって、
  // このデータの公開者ではない。混ぜないこと
  const sourceDesc = header.slice(header.indexOf('<sourceDesc'));
  const source = {
    author: sourceDesc.match(/<author[^>]*>([^<]*)<\/author>/)?.[1]?.trim() ?? null,
    title: sourceDesc.match(/<title[^>]*>([^<]*)<\/title>/)?.[1]?.trim() ?? null,
    publisher: sourceDesc.match(/<publisher[^>]*>([^<]*)<\/publisher>/)?.[1]?.trim() ?? null,
    date: sourceDesc.match(/<date[^>]*when="([^"]*)"/)?.[1]?.trim()
      ?? sourceDesc.match(/<date[^>]*>([^<]*)<\/date>/)?.[1]?.trim() ?? null,
  };

  return {
    title: one('title'),
    /** データの公開主体。個人ではなくこちらを author にする */
    distributor: one('distributor'),
    /** <authority> があれば団体名。いまは無いが、入れれば自動で追従する */
    authority: one('authority'),
    publishedAt: header.match(/<publicationStmt>[\s\S]*?<date[^>]*when="([^"]*)"/)?.[1] ?? null,
    license: header.match(/<availability>[\s\S]*?target="([^"]*)"/)?.[1] ?? null,
    contributors,
    source,
  };
}

/** IIIF の参照。TEI に入っているので、画像も TEI から導出できる */
export function readFacsimile(xml) {
  const fac = xml.match(/<facsimile[^>]*sameAs="([^"]*)"/)?.[1] ?? null;
  const surfaces = [...xml.matchAll(/<surface[^>]*sameAs="([^"]*)"[^>]*>/g)].map((m) => m[1]);
  const graphics = [...xml.matchAll(/<graphic[^>]*url="([^"]*)"/g)].map((m) => m[1]);
  return { manifest: fac, canvases: surfaces.length, images: graphics.length,
    firstImage: graphics[0] ?? null };
}
