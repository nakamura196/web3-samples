// 取引に出てくるアドレスが「Clio-X の publish の流れの中で何なのか」を対応づける。
//
// 【なぜ要るか】汎用の explorer は 0x… を 0x… としか表示しない。学習の障害は
// そこで、「宛先」と言われても、それが工場なのか、いま作られた資産なのか、
// 手数料の受取先なのかが分からない。ここを埋めるのがこのツールの主目的。
//
// 【限界】下の対応表は、この教材で扱う Sepolia 上の配置に固有のもの。
// 未知のアドレスは、チェーンにコードがあるかどうか（eth_getCode）だけで
// 「鍵を持つアカウント」か「契約」かを判定して表示する。

/** 役割の識別子。訳文は messages の Inspect.roles.* に置く。 */
export type RoleKey =
  | 'publisher'
  | 'factory'
  | 'dataNft'
  | 'datatoken'
  | 'dispenser'
  | 'nftTemplate'
  | 'erc20Template'
  | 'marketFeeCollector'
  | 'feeToken';

export const KNOWN_ADDRESSES: Record<string, RoleKey> = {
  // publish を実行した人（このデモ用の鍵）
  '0xa60ef4e6e8f821f3bd5d42f8067bd5d4a96e0cef': 'publisher',
  // 以前から Sepolia 上にある Ocean の共通契約
  '0xef62fb495266c72a5212a11dce8baa79ec0abeb1': 'factory',
  '0x9c9ee07b8ce907d2f9244f8317c1ed29a3193bae': 'nftTemplate',
  '0xdefd0018969cd2d4e648209f876ade184815f038': 'erc20Template',
  '0x1b083d8584dd3e6ff37d04a6e7e82b5f622f3985': 'feeToken',
  '0x9984b2453ec7d99a73a5b3a46da81f197b753c8d': 'marketFeeCollector',
  // この publish で新しく作られたもの
  '0x04ecc497632847529fc431ba780ffc573fe4ac47': 'dataNft',
  '0x6011b8ba5acd3bbb925fa793e125bfe750ae3655': 'datatoken',
  // Dispenser は新設ではない。Sepolia 上に以前から在る共有契約で、
  // この publish では「このトークンを無償配布する」という登録が足されただけ
  // （コードは 6,708 バイトの本体で、45 バイトのプロキシではない）。
  '0x2720d405ef7cdc8a2e2e5aebc8883c99611d893c': 'dispenser',
};

/** この publish で新設された契約（＝それ以前は存在しなかったもの） */
export const CREATED_HERE: RoleKey[] = ['dataNft', 'datatoken'];

export const roleOf = (address?: string | null): RoleKey | null =>
  address ? (KNOWN_ADDRESSES[address.toLowerCase()] ?? null) : null;
