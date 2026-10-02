import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // このアプリはサーバ側の状態を一切持たない。鍵の生成も署名も
  // すべてブラウザ内で完結し、XRPL Testnet へは WebSocket で直接つなぐ。
  reactStrictMode: true,
};

export default nextConfig;
