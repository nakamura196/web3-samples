import { setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '@/samples/st-registry/nav';
import { OnChainVocabulary } from '@/samples/st-registry/components/OnChainVocabulary';
import { Provenance } from '@/samples/st-registry/components/Provenance';
import { TryRecord } from '@/samples/st-registry/components/TryRecord';
import { TrySettle } from '@/samples/st-registry/components/TrySettle';
import { TrySign } from '@/samples/st-registry/components/TrySign';
import { VocabVersion } from '@/samples/st-registry/components/VocabVersion';
import { CHAIN, ADDR, EXPLORER } from '@/samples/st-registry/lib/chain';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function OnChain({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('st-registry.OnChain');

  const vocabLabels = {
    title: t('vTitle'), lead: t('vLead'), field: t('field'), tier: t('tier'),
    requires: t('requires'), basis: t('basis'), asOf: t('asOf'),
    scope: t('scope'), subtype: t('subtype'), empty: t('empty'),
  };
  const provLabels = {
    title: t('pTitle'), lead: t('pLead'), block: t('block'), property: t('property'),
    field: t('field'), value: t('value'), basis: t('basis'), empty: t('empty'),
    blocks: t('blocks'), reload: t('reload'), limit: t('limit'), by: t('by'), ver: t('ver'),
  };
  const tryLabels = {
    title: t('tTitle'), lead: t('tLead'), connect: t('connect'), send: t('send'),
    sending: t('sending'), accepted: t('accepted'), rejected: t('rejected'),
    noWallet: t('noWallet'), noBasis: t('noBasis'), expectOk: t('expectOk'),
    expectNo: t('expectNo'), note: t('tNote'), selected: t('selected'),
  };

  return (
    <div className="container mx-auto px-4 py-10 flex flex-col gap-10 max-w-5xl">
      <header className="flex flex-col gap-3">
        <div className="font-mono text-xs tracking-widest uppercase text-blue-800 dark:text-blue-300">
          {t('kicker')}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold leading-tight">{t('title')}</h1>
        <p className="max-w-2xl text-gray-600 dark:text-gray-300">{t('lead')}</p>
        <div className="font-mono text-xs text-gray-500 dark:text-gray-400">
          {CHAIN.name} · chain {CHAIN.id} ·{' '}
          {EXPLORER ? (
            <a className="underline" href={`${EXPLORER}/address/${ADDR.registry}`} target="_blank" rel="noreferrer">
              {ADDR.registry}
            </a>
          ) : (
            ADDR.registry
          )}
        </div>
      </header>

      <section className="border-l-4 border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 max-w-3xl flex flex-col gap-2">
        <div className="font-bold text-sm">{t('whyTitle')}</div>
        <p className="text-sm text-gray-700 dark:text-gray-300">{t('whyBody')}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">{t('readTitle')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">{t('readLead')}</p>
        <VocabVersion labels={{ title: t('verTitle'), body: t('verBody') }} />
        <OnChainVocabulary labels={vocabLabels} />
      </section>

      <section className="flex flex-col gap-3">
        <Provenance labels={provLabels} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">{t('writeTitle')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">{t('writeLead')}</p>
        <TryRecord labels={tryLabels} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">{t('signTitle')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">{t('signLead')}</p>
        <TrySign
          labels={{
            title: t('gTitle'), lead: t('gLead'), connect: t('connect'),
            valueLabel: t('gValue'), sign: t('gSign'), submit: t('gSubmit'),
            tamper: t('gTamper'), signed: t('gSigned'), sigFor: t('gSigFor'),
            attestedYou: t('gYou'), attestedOther: t('gOther'),
            failed: t('failed'), noWallet: t('noWallet'), note: t('gNote'),
          }}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">{t('dvpTitle')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">{t('dvpLead')}</p>
        <TrySettle
          labels={{
            title: t('dTitle'), lead: t('dLead'), connect: t('connect'),
            exec: t('exec'), ok: t('okDone'), sending: t('sending'),
            done: t('done'), failed: t('failed'), noWallet: t('noWallet'),
            sRegister: t('sRegister'), hRegister: t('hRegister'),
            sMint: t('sMint'), hMint: t('hMint'),
            sApprove: t('sApprove'), hApprove: t('hApprove'),
            sSettle: t('sSettle'), hSettle: t('hSettle'),
            settleDone: t('settleDone'), note: t('dNote'),
            sBorrow: t('sBorrow'), hBorrow: t('hBorrow'), borrowDone: t('borrowDone'),
          }}
        />
      </section>

      <section className="border-l-4 border-amber-600 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 max-w-3xl">
        <div className="font-bold text-sm">{t('limitTitle')}</div>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{t('limitBody')}</p>
      </section>
    </div>
  );
}
