// 旧 st-registry → web3-samples の /st-registry
const TARGET = 'https://web3-samples.na-kamura-1263.workers.dev';

function map(path) {
  if (/^\/(data|static)\//.test(path) || /^\/ogp-(ja|en)\.svg$/.test(path)) {
    return `/assets/st-registry${path}`;
  }
  const m = path.match(/^\/(en|ja)(\/.*)?$/);
  const locale = m && m[1] === 'en' ? '/en' : ''; // ja は接頭辞なしが正
  const rest = (m ? m[2] : path) || '/';
  return `${locale}/st-registry${rest === '/' ? '' : rest}`;
}

export default {
  fetch(request) {
    const url = new URL(request.url);
    return Response.redirect(TARGET + map(url.pathname) + url.search, 301);
  },
};
