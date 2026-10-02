import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

/**
 * 翻訳文は「全体の分」と「部屋ごとの分」を 1 つにまとめて渡す。
 * 部屋の文は部屋の名前の下に入る（例: chain-lens.Inspect.title）。
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const [shared, minisig, stRegistry, chainLens, tictactoe] = await Promise.all([
    import(`@/messages/${locale}.json`),
    import(`@/samples/minisig/messages/${locale}.json`),
    import(`@/samples/st-registry/messages/${locale}.json`),
    import(`@/samples/chain-lens/messages/${locale}.json`),
    import(`@/samples/tictactoe/messages/${locale}.json`),
  ]);

  return {
    locale,
    messages: {
      ...shared.default,
      minisig: minisig.default,
      'st-registry': stRegistry.default,
      'chain-lens': chainLens.default,
      tictactoe: tictactoe.default,
    },
  };
});
