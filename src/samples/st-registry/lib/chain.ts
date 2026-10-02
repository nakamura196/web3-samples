/**
 * チェーンへの入口。
 *
 * genji-x が索引サーバを捨てて公開 RPC に直接問い合わせたのと同じ理由で、
 * この画面も**記述を別サーバに持たせない**。
 *
 * 発端は 2026-08-26 の調査だった。不動産ST の目論見書には
 * 「延床面積（登記簿）」「稼働率（面積ベース）」のように、数値へ必ず
 * 根拠と基準時点が添えられている。ところが運用サイトではそれが落ち、
 * ただの「延床面積」「稼働率」になる。数値だけでは銘柄をまたいで
 * 比較できず、担保評価も自動化できない。
 *
 * ここでは値・根拠・基準時点を 1 組としてチェーンに置く。
 * 読むだけならウォレットは要らない。書くときだけ MetaMask を使う。
 */
import { createPublicClient, http, defineChain } from 'viem';
import { sepolia } from 'viem/chains';

/** ローカル検証用 (anvil) */
export const anvil = defineChain({
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
});

/**
 * Oasis Sapphire Testnet — 秘匿 EVM。
 * ストレージが暗号化されるので、目論見書で「非開示」とされる賃料を
 * 隠したまま担保判定に使える。Pontus-X もこの上に建っているが、
 * あちらは組織登録(Gaia-X の Trust Anchor 審査)が要る。Sapphire 単体は不要。
 */
export const sapphireTestnet = defineChain({
  id: 23295,
  name: 'Oasis Sapphire Testnet',
  nativeCurrency: { name: 'Sapphire Test ROSE', symbol: 'TEST', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet.sapphire.oasis.io'] } },
  blockExplorers: { default: { name: 'Oasis Explorer', url: 'https://explorer.oasis.io/testnet/sapphire' } },
});

const WHICH = process.env.NEXT_PUBLIC_CHAIN || 'sapphire';

export const CHAIN =
  WHICH === 'anvil' ? anvil : WHICH === 'sepolia' ? sepolia : sapphireTestnet;

export const EXPLORER =
  WHICH === 'anvil' ? '' :
  WHICH === 'sepolia' ? 'https://sepolia.etherscan.io' :
  'https://explorer.oasis.io/testnet/sapphire';

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  (WHICH === 'anvil' ? 'http://127.0.0.1:8545'
   : WHICH === 'sepolia' ? 'https://ethereum-sepolia-rpc.publicnode.com'
   : 'https://testnet.sapphire.oasis.io');

export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(RPC_URL, { batch: true, retryCount: 2 }),
});

/**
 * 配備済みアドレス。
 * anvil は決定的に同じ順で払い出すので、再起動しても変わらない。
 */
export const ADDR = {
  registry: '0x149b3f0a0b8b337aafc72ca828c85a9ae4592bba' as `0x${string}`,
  jpy: '0xbedccbc1989f9c7e9866484c3b26743c47ee54b8' as `0x${string}`,
  dvp: '0x86c84ed6491d61025f5eff9df5cdf9cf5ad83b44' as `0x${string}`,
  vault: '0x5494932ebff025e1d2f1329d8785c301f840aad7' as `0x${string}`,
  rent: '0xe876ac16d19aaa231ad1b1293faba937f2ff7783' as `0x${string}`,
} as const;

/**
 * 画面に並べる 2 銘柄。同じ稼働率 100% で、根拠の有無だけが違う。
 *
 * **銘柄名は架空。** 面積・鑑定評価額・稼働率は、公開されているケネディクス
 * 物流3件の目論見書(2025年5月)の数値に基づく。賃料は目論見書で「非開示」の
 * ため仮の値を置いている。実在の物件名を付けると、創作した賃料が実データと
 * 取り違えられるので、名前は架空にしてある。
 */
export const PROPERTIES = [
  {
    id: 'PROP_A',
    st: '0x13a2792076d5f4e716446800ecbe097364fb3740' as `0x${string}`,
    name: { ja: '物件α(架空)', en: 'Property Alpha (fictional)' },
    source: { ja: '目論見書の書き方 — 根拠つき', en: 'As written in the prospectus' },
  },
  {
    id: 'PROP_B',
    st: '0x04176f5d4882aa0f954f90ff375eadad579240e3' as `0x${string}`,
    name: { ja: '物件β(架空)', en: 'Property Beta (fictional)' },
    source: { ja: '運用サイトの書き方 — 根拠が落ちている', en: 'As shown on the operator site' },
  },
] as const;

// ── ABI。使う分だけ ────────────────────────────────────────────

export const REGISTRY_ABI = [
  {
    type: 'function',
    name: 'get',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }, { type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'value', type: 'uint256' },
          { name: 'basis', type: 'bytes32' },
          { name: 'asOf', type: 'uint64' },
          { name: 'scope', type: 'bytes32' },
          { name: 'subtype', type: 'bytes32' },
          { name: 'vocabVersion', type: 'uint16' },
          { name: 'attestedBy', type: 'address' },
          { name: 'set', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'isRecorded',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }, { type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'fieldCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'basisAllowed',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }, { type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'fieldAt',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'spec',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }],
    outputs: [
      { name: 'defined', type: 'bool' },
      { name: 'needsBasis', type: 'bool' },
      { name: 'needsAsOf', type: 'bool' },
      { name: 'needsScope', type: 'bool' },
      { name: 'needsSubtype', type: 'bool' },
      { name: 'tier', type: 'uint8' },
    ],
  },
  {
    type: 'event',
    name: 'Recorded',
    inputs: [
      { name: 'propertyId', type: 'bytes32', indexed: true },
      { name: 'field', type: 'bytes32', indexed: true },
      { name: 'value', type: 'uint256' },
      { name: 'basis', type: 'bytes32' },
      { name: 'asOf', type: 'uint64' },
    ],
  },
  {
    type: 'event',
    name: 'FieldDefined',
    inputs: [
      { name: 'field', type: 'bytes32', indexed: true },
      { name: 'tier', type: 'uint8' },
    ],
  },
  {
    type: 'event',
    name: 'BasisAllowed',
    inputs: [
      { name: 'field', type: 'bytes32', indexed: true },
      { name: 'basis', type: 'bytes32', indexed: true },
    ],
  },
  {
    type: 'function', name: 'vocabVersion', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint16' }],
  },
  {
    type: 'function', name: 'fieldSince', stateMutability: 'view',
    inputs: [{ type: 'bytes32' }], outputs: [{ type: 'uint16' }],
  },
  {
    type: 'function', name: 'domainSeparator', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function', name: 'record', stateMutability: 'nonpayable',
    inputs: [
      { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' },
      { type: 'bytes32' }, { type: 'uint64' },
    ],
    outputs: [],
  },
  {
    type: 'function', name: 'recordSigned', stateMutability: 'nonpayable',
    inputs: [
      {
        type: 'tuple',
        components: [
          { name: 'propertyId', type: 'bytes32' },
          { name: 'field', type: 'bytes32' },
          { name: 'value', type: 'uint256' },
          { name: 'basis', type: 'bytes32' },
          { name: 'asOf', type: 'uint64' },
          { name: 'scope', type: 'bytes32' },
          { name: 'subtype', type: 'bytes32' },
        ],
      },
      { type: 'bytes' },
    ],
    outputs: [],
  },
  { type: 'error', name: 'BadSignature', inputs: [] },
  { type: 'error', name: 'UnknownField', inputs: [{ type: 'bytes32' }] },
  { type: 'error', name: 'BasisRequired', inputs: [{ type: 'bytes32' }] },
  { type: 'error', name: 'BasisNotInVocabulary', inputs: [{ type: 'bytes32' }, { type: 'bytes32' }] },
  { type: 'error', name: 'AsOfRequired', inputs: [{ type: 'bytes32' }] },
  { type: 'error', name: 'NotRecorded', inputs: [{ type: 'bytes32' }, { type: 'bytes32' }] },
] as const;

export const VAULT_ABI = [
  {
    type: 'function', name: 'borrow', stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [],
  },
  {
    type: 'function',
    name: 'borrowingPower',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }],
    outputs: [{ type: 'uint256' }],
  },
  // レジストリから投げられるエラーも Vault 越しに返ってくる。
  // ABI に無いと viem が名前を復号できず、画面に revert () とだけ出る。
  { type: 'error', name: 'NotRecorded', inputs: [{ type: 'bytes32' }, { type: 'bytes32' }] },
  {
    type: 'function', name: 'vocabVersion', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint16' }],
  },
  {
    type: 'function', name: 'fieldSince', stateMutability: 'view',
    inputs: [{ type: 'bytes32' }], outputs: [{ type: 'uint16' }],
  },
  {
    type: 'function', name: 'domainSeparator', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function', name: 'record', stateMutability: 'nonpayable',
    inputs: [
      { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' },
      { type: 'bytes32' }, { type: 'uint64' },
    ],
    outputs: [],
  },
  {
    type: 'function', name: 'recordSigned', stateMutability: 'nonpayable',
    inputs: [
      {
        type: 'tuple',
        components: [
          { name: 'propertyId', type: 'bytes32' },
          { name: 'field', type: 'bytes32' },
          { name: 'value', type: 'uint256' },
          { name: 'basis', type: 'bytes32' },
          { name: 'asOf', type: 'uint64' },
          { name: 'scope', type: 'bytes32' },
          { name: 'subtype', type: 'bytes32' },
        ],
      },
      { type: 'bytes' },
    ],
    outputs: [],
  },
  { type: 'error', name: 'BadSignature', inputs: [] },
  { type: 'error', name: 'UnknownField', inputs: [{ type: 'bytes32' }] },
  { type: 'error', name: 'UnusableOccupancyBasis', inputs: [{ type: 'bytes32' }] },
  { type: 'error', name: 'StaleData', inputs: [{ type: 'uint64' }] },
  { type: 'error', name: 'OccupancyTooLow', inputs: [{ type: 'uint256' }] },
  { type: 'error', name: 'ExceedsLtv', inputs: [] },
] as const;

export const RENT_ABI = [
  {
    type: 'function',
    name: 'meetsCoverage',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32' }, { type: 'uint256' }, { type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
] as const;

export const ST_ABI = [
  {
    type: 'function', name: 'eligible', stateMutability: 'view',
    inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }],
  },
  { type: 'function', name: 'selfRegister', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'error', name: 'NotEligible', inputs: [{ type: 'address' }] },
  { type: 'error', name: 'NotIssuer', inputs: [] },
] as const;

export const JPY_ABI = [
  {
    type: 'function', name: 'mint', stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [],
  },
  {
    type: 'function', name: 'approve', stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }],
  },
  {
    type: 'function', name: 'allowance', stateMutability: 'view',
    inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }],
  },
] as const;

export const DVP_ABI = [
  {
    type: 'function', name: 'settle', stateMutability: 'nonpayable',
    inputs: [
      { type: 'address' }, { type: 'address' }, { type: 'address' },
      { type: 'address' }, { type: 'uint256' }, { type: 'uint256' },
    ],
    outputs: [],
  },
  { type: 'error', name: 'InsufficientBalance', inputs: [] },
  { type: 'error', name: 'InsufficientAllowance', inputs: [] },
] as const;

// ── 項目キーと根拠の語彙 ────────────────────────────────────────
// bytes32 は ASCII のみ。括弧内は目論見書での表記。

// 項目キーは src/data/vocabulary.json の id と同じ。
// 契約側は語彙をチェーン上のデータとして持っているので、ここは参照するだけ。
export const FIELD = {
  OCCUPANCY: 'occupancy', // 稼働率
  GROSS_FLOOR_AREA: 'grossFloorArea', // 延床面積
  APPRAISAL_VALUE: 'appraisalValue', // 鑑定評価額
  LAND_AREA: 'landArea', // 敷地面積
  REVENUE_UNITS: 'revenueUnits', // 収益単位数
  UNDECLARED_OCC: 'occupancyUndeclared', // 根拠のない稼働率(銘柄B の再現用)
} as const;

export const BASIS_LABEL: Record<string, { ja: string; en: string }> = {
  BY_AREA: { ja: '面積ベース', en: 'by area' },
  BY_UNITS: { ja: '単位数ベース', en: 'by units' },
  REGISTRY: { ja: '登記簿', en: 'land registry' },
  INSPECTION: { ja: '検査済証', en: 'inspection certificate' },
  APPRAISAL: { ja: '鑑定', en: 'appraisal' },
  UNDECLARED: { ja: '— 宣言なし —', en: '— undeclared —' },
  JUKYO: { ja: '住居表示', en: 'residential address' },
  CHIBAN: { ja: '登記簿の地番', en: 'lot number' },
  SURVEYED: { ja: '実測', en: 'surveyed' },
  DWELLINGS: { ja: '戸数', en: 'dwellings' },
  ROOMS: { ja: '室数', en: 'rooms' },
  TENANTS: { ja: 'テナント数', en: 'tenants' },
};

/** 項目 id → 表示名。語彙(vocabulary.json)の id と対応する。 */
export const FIELD_LABEL: Record<string, { ja: string; en: string }> = {
  propertyName: { ja: '物件名称', en: 'Property name' },
  address: { ja: '所在', en: 'Location' },
  landArea: { ja: '敷地面積', en: 'Land area' },
  grossFloorArea: { ja: '延床面積', en: 'Gross floor area' },
  zoning: { ja: '用途地域', en: 'Zoning' },
  structure: { ja: '構造', en: 'Structure' },
  builtAt: { ja: '建築時期', en: 'Built' },
  tenure: { ja: '所有形態', en: 'Tenure' },
  appraisalValue: { ja: '鑑定評価額', en: 'Appraisal value' },
  occupancy: { ja: '稼働率', en: 'Occupancy' },
  revenueUnits: { ja: '収益単位数', en: 'Revenue units' },
  leasableArea: { ja: '賃貸可能面積', en: 'Leasable area' },
  occupancyUndeclared: { ja: '稼働率(根拠なし)', en: 'Occupancy (no basis)' },
  seismicPml: { ja: '地震PML', en: 'Seismic PML' },
};

export const TIER_LABEL: Record<number, { ja: string; en: string }> = {
  0: { ja: '中核', en: 'core' },
  1: { ja: '推奨', en: 'recommended' },
  2: { ja: '拡張', en: 'extension' },
};

/** 担保評価に使える稼働率の分母。これ以外はコントラクトが拒否する。 */
export const USABLE_OCCUPANCY_BASIS = ['BY_AREA', 'BY_UNITS'];

/** bytes32 の右パディングを外して文字列に戻す */
export function fromBytes32(hex: string): string {
  const body = hex.replace(/^0x/, '').replace(/(00)+$/, '');
  return body.replace(/../g, (b) => String.fromCharCode(parseInt(b, 16)));
}

/** 文字列を bytes32 に右パディングする */
export function toBytes32(s: string): `0x${string}` {
  const hex = Array.from(s)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
  return `0x${hex.padEnd(64, '0')}` as `0x${string}`;
}
