/**
 * この部屋 (/st-registry) の中で使うリンク。
 *
 * 元は独立したアプリだったので、コードは「/」が自分のトップだと思って書かれている。
 * ここで /st-registry を前置し、usePathname では外すことで、元のコードを書き換えずに済ませる。
 * /api/ と外部 URL はそのまま通す。
 */
import { createSampleNavigation } from '@/lib/sample-navigation';

export { routing } from '@/i18n/routing';
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createSampleNavigation('/st-registry');
