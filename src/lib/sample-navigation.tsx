import type { ComponentProps } from 'react';
import { createNavigation } from 'next-intl/navigation';
import { routing } from '@/i18n/routing';

/**
 * 部屋（/minisig、/chain-lens など）の中で使うナビゲーション。
 *
 * 各サンプルは元々独立したアプリで、「/」を自分のトップとして書かれている。
 * ここで行き先に部屋の接頭辞を足し、usePathname では外す。
 * そうすれば元のコードを 1 行ずつ書き換えずに済む。
 */
const nav = createNavigation(routing);

type LinkHref = ComponentProps<typeof nav.Link>['href'];
type RouterHref = Parameters<ReturnType<typeof nav.useRouter>['push']>[0];
type AnyHref = string | { pathname?: string | null };

/** /api/ と外部の URL、# や ? だけのものはそのまま通す */
function needsBase(path: string) {
  return path.startsWith('/') && !path.startsWith('/api/') && !path.startsWith('//');
}

export function createSampleNavigation(base: `/${string}`) {
  const join = (path: string) => (path === '/' ? base : `${base}${path}`);
  const withBase = <T extends AnyHref>(href: T): T => {
    if (typeof href === 'string') return (needsBase(href) ? join(href) : href) as T;
    const { pathname } = href;
    if (typeof pathname === 'string' && needsBase(pathname)) {
      return { ...(href as object), pathname: join(pathname) } as T;
    }
    return href;
  };

  const stripBase = (pathname: string) => {
    if (pathname === base) return '/';
    if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length);
    return pathname;
  };

  function Link({ href, ...rest }: ComponentProps<typeof nav.Link>) {
    return <nav.Link href={withBase<LinkHref>(href)} {...rest} />;
  }

  const usePathname = () => stripBase(nav.usePathname());

  const useRouter = () => {
    const router = nav.useRouter();
    return {
      ...router,
      push: (href: RouterHref, options?: Parameters<typeof router.push>[1]) =>
        router.push(withBase(href), options),
      replace: (href: RouterHref, options?: Parameters<typeof router.replace>[1]) =>
        router.replace(withBase(href), options),
      prefetch: (href: RouterHref, options?: Parameters<typeof router.prefetch>[1]) =>
        router.prefetch(withBase(href), options),
    };
  };

  const redirect = (args: Parameters<typeof nav.redirect>[0]) =>
    nav.redirect({ ...args, href: withBase(args.href) });

  const getPathname = (args: Parameters<typeof nav.getPathname>[0]) =>
    nav.getPathname({ ...args, href: withBase(args.href) });

  return { Link, usePathname, useRouter, redirect, getPathname };
}
