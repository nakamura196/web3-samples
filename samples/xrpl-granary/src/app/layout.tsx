import type { Metadata } from 'next';
import './globals.css';
import { SiteNav } from '@/components/SiteNav';

export const metadata: Metadata = {
  title: '米切手 — 蔵屋敷の預り証を XRPL に載せる',
  description:
    '江戸時代の大坂の米切手を XRP Ledger Testnet 上で再現する学習用デモ。トークン発行・信用線・ネイティブ DEX での決済をブラウザだけで実行する。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
