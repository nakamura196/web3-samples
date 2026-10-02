// 旧 minisig-app → web3-samples の /minisig。API は同じパスのまま送る
const TARGET = 'https://web3-samples.na-kamura-1263.workers.dev';

function map(path) {
  if (path.startsWith('/api/') || path.startsWith('/swagger/')) return path;
  if (/^\/ogp-(ja|en)\.svg$/.test(path)) return `/assets/minisig${path}`;
  const m = path.match(/^\/(en|ja)(\/.*)?$/);
  const locale = m ? `/${m[1]}` : '';
  const rest = (m ? m[2] : path) || '/';
  if (rest === '/') return `${locale}/minisig`;
  if (rest === '/minisig') return `${locale}/minisig/app`;
  return `${locale}/minisig${rest}`;
}

export default {
  fetch(request) {
    const url = new URL(request.url);
    const status = url.pathname.startsWith('/api/') ? 308 : 301;
    return Response.redirect(TARGET + map(url.pathname) + url.search, status);
  },
};
