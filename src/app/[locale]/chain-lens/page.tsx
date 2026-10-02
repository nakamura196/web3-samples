import { routing } from '@/samples/chain-lens/nav';
import { setRequestLocale } from 'next-intl/server';
import Hero from '@/samples/chain-lens/components/page/home/Hero';
import Samples from '@/samples/chain-lens/components/page/home/Samples';

// SSR対応
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main>
      <Hero />
      <Samples />
    </main>
  );
}
