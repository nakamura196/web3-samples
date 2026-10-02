// 本書・本ツールが教材にしている実際の取引。
//
// 2026-08-13、国立国会図書館デジタルコレクションの古典籍『歳旦発句牒』(1682) の
// IIIF マニフェストを、Ocean Protocol ベースのデータスペースのポータルに
// 1 件 publish したときに Sepolia に記録されたもの。
// publish 1 回で取引は 2 本。どちらも公開チェーン上に残っており、消えない。
// 並びは publish ウィザードの最終段（STEP 6）の順に合わせる。
// 画面には3段が示されるが、チェーンに書くのは ① と ③ の 2 本だけ。
export const SAMPLES = [
  {
    key: 'create',
    hash: '0x2d29cc0626971b6c71bc135e4f68bbe711da1b16f6098664724bf4a7f7f8bc84',
  },
  {
    key: 'metadata',
    hash: '0x2b699f1d67904dc675e204702318bf7c4bca9cb53e38ecfaed3252f0cecb9103',
  },
] as const;

/** 解説書（別サイト） */
export const BOOK_URL = 'https://ldas.jp/ja/books/blockchain-by-reading/';

// Sepolia に「公式の」explorer は無い。Etherscan が事実上の標準で、
// Blockscout も同等の役割を果たしている。比較できるよう両方を出す。
export const EXPLORERS = [
  { name: 'Etherscan', tx: (h: string) => `https://sepolia.etherscan.io/tx/${h}` },
  { name: 'Blockscout', tx: (h: string) => `https://eth-sepolia.blockscout.com/tx/${h}` },
] as const;
