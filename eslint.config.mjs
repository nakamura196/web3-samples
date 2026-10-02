import next from 'eslint-config-next';

/**
 * ESLint flat config (ESLint 9 / Next.js 16).
 * `eslint-config-next` already bundles `next/core-web-vitals`,
 * `next/typescript` and a sensible `ignores` block, so we just
 * spread it and layer project-specific overrides on top.
 */
const eslintConfig = [
  // cloudflare-env.d.ts は `npm run cf-typegen` の生成物なので対象外
  { ignores: ['.next/**', 'out/**', 'build/**', 'cloudflare-env.d.ts', '.open-next/**', '.wrangler/**', 'public/**', 'contracts/**', 'samples/**'] },
  ...next,
  {
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
];

export default eslintConfig;
