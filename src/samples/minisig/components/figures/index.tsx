import { getTranslations } from 'next-intl/server';
import Figure from './Figure';
import { twoHop, threshold, offChain } from './shapes';

/** 図ごとに、翻訳を読んでラベルを差し込む薄いラッパ */

const pick = (t: (k: string) => string, keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, t(k)]));

export async function TwoHopFigure() {
  const t = await getTranslations('minisig.Figures.twoHop');
  return (
    <Figure
      data={twoHop}
      caption={t('caption')}
      emphasis={['b', 'note']}
      labels={pick(t, ['a', 'b', 'c', 'step1', 'step1b', 'step2', 'step2b', 'note'])}
    />
  );
}

export async function ThresholdFigure() {
  const t = await getTranslations('minisig.Figures.threshold');
  return (
    <Figure
      data={threshold}
      caption={t('caption')}
      emphasis={['vault', 'vaultSub']}
      labels={pick(t, ['k1', 'k2', 'k3', 'vault', 'vaultSub', 'cut'])}
    />
  );
}

export async function OffChainFigure() {
  const t = await getTranslations('minisig.Figures.offChain');
  return (
    <Figure
      data={offChain}
      caption={t('caption')}
      emphasis={['offTitle', 'chainTitle']}
      labels={pick(t, ['offTitle', 'chainTitle', 'r1', 'r2', 'r3', 'chainBody', 'chainSub'])}
    />
  );
}
