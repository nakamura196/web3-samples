/** このサイトが扱う対象。チェーンとデプロイ済みコントラクト。 */

export const CHAIN_INFO = {
  name: 'Base Sepolia',
  chainId: 84532,
  rpc: 'https://sepolia.base.org',
  explorer: 'https://sepolia.basescan.org',
  faucet: 'https://faucet.zalalena.com/base',
} as const;

export type Deployment = {
  address: `0x${string}`;
  ownersLabel: { ja: string; en: string };
  note: { ja: string; en: string };
  governance: boolean;
  primary?: boolean;
};

/** Base Sepolia 上にデプロイした MiniSig の一覧 */
export const DEPLOYMENTS: Deployment[] = [
  {
    address: '0x60D6F9301B8616520cA10128C63040b6C532717F',
    ownersLabel: { ja: '3人 / 閾値 2', en: '3 owners / threshold 2' },
    note: {
      ja: 'このサイトの既定。所有者の追加・削除に対応した版',
      en: 'Default for this site. Supports adding and removing owners.',
    },
    governance: true,
    primary: true,
  },
  {
    address: '0x8bF02e825C3fC1a944E908EBf1b7f815601D4EF9',
    ownersLabel: { ja: '4人 / 閾値 2', en: '4 owners / threshold 2' },
    note: {
      ja: '決議によって所有者を3人から4人に増やした実例',
      en: 'A live example where a resolution grew the owner set from 3 to 4.',
    },
    governance: true,
  },
  {
    address: '0x44096901e6eF9026991062df0140EF93ea9F5994',
    ownersLabel: { ja: '3人 / 閾値 2', en: '3 owners / threshold 2' },
    note: {
      ja: '初期版。所有者は固定で変更できない',
      en: 'Earlier build. The owner set is fixed at deployment.',
    },
    governance: false,
  },
];

export const LINKS = {
  safe: 'https://safe.global',
  viem: 'https://viem.sh',
  foundry: 'https://getfoundry.sh',
  opennext: 'https://opennext.js.org/cloudflare',
  template: 'https://github.com/nakamura196/nextjs-i18n-themes-ssr-template',
} as const;
