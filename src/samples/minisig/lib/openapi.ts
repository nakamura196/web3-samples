import { DEPLOYMENTS } from '@/samples/minisig/constants/site';

const PRIMARY = DEPLOYMENTS.find((d) => d.primary)!.address;

const addressParam = {
  name: 'address',
  in: 'path',
  required: true,
  description: 'MiniSig コントラクトのアドレス / MiniSig contract address',
  schema: { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$', example: PRIMARY },
} as const;

const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  description: '提案の ID (UUID) / Proposal id (UUID)',
  schema: { type: 'string', format: 'uuid' },
} as const;

const errorResponse = {
  description: 'エラー / Error',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
} as const;

/**
 * MiniSig の OpenAPI 定義。
 *
 * 設計の要点は「鍵が要る操作をひとつも含まない」こと。
 * 署名の生成と送信はクライアント側にあり、サーバは
 * 読み取り・検証・保管・calldata の組み立てだけを行う。
 */
export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'MiniSig API',
    version: '1.0.0',
    description:
      '自作マルチシグ MiniSig を操作する API。サーバは秘密鍵を一切持たない。' +
      '署名の生成と送信はクライアント側で行う。\n\n' +
      'An API for the hand-rolled MiniSig multisig. The server never holds a private key; ' +
      'signing and broadcasting happen client-side.',
    license: { name: 'MIT' },
  },
  servers: [{ url: '/', description: 'this deployment' }],
  tags: [
    { name: 'contract', description: 'チェーンの読み取り / Reading the chain' },
    { name: 'proposals', description: '提案と署名 / Proposals and signatures' },
  ],
  paths: {
    '/api/minisig/{address}': {
      get: {
        tags: ['contract'],
        summary: 'コントラクトの現在の状態',
        description: '所有者・閾値・nonce・残高をチェーンから読む。',
        parameters: [addressParam],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ContractState' } },
            },
          },
          '400': errorResponse,
          '502': errorResponse,
        },
      },
    },
    '/api/minisig/{address}/proposals': {
      get: {
        tags: ['proposals'],
        summary: '提案の一覧',
        parameters: [addressParam],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ProposalList' } },
            },
          },
          '400': errorResponse,
        },
      },
      post: {
        tags: ['proposals'],
        summary: '提案を作成する',
        description:
          'txHash はクライアントから受け取らない。必ずコントラクトに計算させる。' +
          'クライアントが計算したハッシュを信用すると、そこが改竄点になるため。',
        parameters: [addressParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/NewProposal' },
              example: { to: PRIMARY, value: '100000000000000' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Proposal' } },
            },
          },
          '400': errorResponse,
        },
      },
    },
    '/api/minisig/{address}/proposals/{id}': {
      get: {
        tags: ['proposals'],
        summary: '提案ひとつの状態',
        description: 'nonce が進んでいれば stale=true になり、集めた署名は無効になる。',
        parameters: [addressParam, idParam],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ProposalDetail' } },
            },
          },
          '404': errorResponse,
        },
      },
    },
    '/api/minisig/{address}/proposals/{id}/signatures': {
      post: {
        tags: ['proposals'],
        summary: '署名を追加する',
        description:
          '署名者は自己申告させない。サーバが署名から署名者を復元し、' +
          'チェーン上の所有者リストと照合する。重複と古い提案は拒否する。',
        parameters: [addressParam, idParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/NewSignature' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/SignatureAccepted' } },
            },
          },
          '404': errorResponse,
          '409': { ...errorResponse, description: '重複、または提案が古い / Duplicate or stale' },
          '422': { ...errorResponse, description: '所有者ではない / Signer is not an owner' },
        },
      },
    },
    '/api/minisig/{address}/proposals/{id}/calldata': {
      get: {
        tags: ['proposals'],
        summary: '送信できる calldata を取得する',
        description:
          '署名が閾値に達していれば、そのまま送信できる calldata を返す。**送信はしない。**' +
          'ガスを払う鍵はサーバに無い。',
        parameters: [addressParam, idParam],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Calldata' } },
            },
          },
          '404': errorResponse,
          '409': { ...errorResponse, description: '署名不足、または提案が古い / Not enough signatures or stale' },
        },
      },
    },
  },
  components: {
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
        required: ['error'],
      },
      Address: { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$' },
      ContractState: {
        type: 'object',
        properties: {
          contract: { $ref: '#/components/schemas/Address' },
          chainId: { type: 'integer', example: 84532 },
          owners: { type: 'array', items: { $ref: '#/components/schemas/Address' } },
          threshold: { type: 'integer', example: 2 },
          nonce: { type: 'integer', example: 0 },
          balanceWei: { type: 'string', example: '200000000000000' },
        },
      },
      NewProposal: {
        type: 'object',
        required: ['to'],
        properties: {
          to: { $ref: '#/components/schemas/Address' },
          value: { type: 'string', description: 'wei の10進文字列', default: '0' },
          data: { type: 'string', pattern: '^0x([0-9a-fA-F]{2})*$', default: '0x' },
        },
      },
      Signature: {
        type: 'object',
        properties: {
          signer: { $ref: '#/components/schemas/Address' },
          signature: { type: 'string', pattern: '^0x[0-9a-fA-F]{130}$' },
          addedAt: { type: 'string', format: 'date-time' },
        },
      },
      Proposal: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          contract: { $ref: '#/components/schemas/Address' },
          to: { $ref: '#/components/schemas/Address' },
          value: { type: 'string' },
          data: { type: 'string' },
          nonce: { type: 'string' },
          txHash: { type: 'string', pattern: '^0x[0-9a-fA-F]{64}$' },
          createdAt: { type: 'string', format: 'date-time' },
          signatures: { type: 'array', items: { $ref: '#/components/schemas/Signature' } },
          threshold: { type: 'integer' },
          signHint: { type: 'string', description: 'cast での署名コマンド例' },
        },
      },
      ProposalDetail: {
        allOf: [
          { $ref: '#/components/schemas/Proposal' },
          {
            type: 'object',
            properties: {
              collected: { type: 'integer' },
              ready: { type: 'boolean' },
              stale: { type: 'boolean' },
              staleReason: { type: 'string' },
            },
          },
        ],
      },
      ProposalList: {
        type: 'object',
        properties: {
          contract: { $ref: '#/components/schemas/Address' },
          nonce: { type: 'integer' },
          threshold: { type: 'integer' },
          proposals: { type: 'array', items: { $ref: '#/components/schemas/ProposalDetail' } },
        },
      },
      NewSignature: {
        type: 'object',
        required: ['signature'],
        properties: {
          signature: {
            type: 'string',
            pattern: '^0x[0-9a-fA-F]{130}$',
            description: '65バイトの署名。EIP-191 前置きつきで txHash に署名したもの',
          },
        },
      },
      SignatureAccepted: {
        type: 'object',
        properties: {
          signer: { $ref: '#/components/schemas/Address' },
          collected: { type: 'integer' },
          threshold: { type: 'integer' },
          ready: { type: 'boolean' },
        },
      },
      Calldata: {
        type: 'object',
        properties: {
          to: { $ref: '#/components/schemas/Address' },
          data: { type: 'string', description: 'execTransaction の calldata' },
          value: { type: 'string', example: '0' },
          signatures: { type: 'string', description: '署名者アドレスの昇順に連結したもの' },
          signers: { type: 'array', items: { $ref: '#/components/schemas/Address' } },
          sendHint: { type: 'string', description: 'cast send の例' },
        },
      },
    },
  },
} as const;
