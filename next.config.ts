import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  basePath,
};

export default withNextIntl(nextConfig);

// `next dev` でも Cloudflare のバインディング (KV) をローカル模擬で使えるようにする
initOpenNextCloudflareForDev();
