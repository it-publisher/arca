import { CONTENT, REPO_URL } from './content.js';
import { BRAND_MARK, icon } from './icons.js';

// Intrinsic sizes of the screenshots (2x of the capture viewport), so the layout doesn't jump while they load.
const SCREEN_SIZES = { editor: [2880, 1800], note: [2200, 1600], code: [2200, 1280], burn: [2200, 840] };

const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; "
  + "connect-src 'none'; font-src 'self'; base-uri 'none'; form-action 'none'";

const escapeHtml = (text) => text
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/** Links between languages: the same page in the other language. */
function langUrl({ root, lang, pagePath }) {
  return `${root}${lang === 'en' ? 'en/' : ''}${pagePath}`;
}

export function screenshot({ root, name, alt, isEager = false }) {
  const [width, height] = SCREEN_SIZES[name];
  const base = `${root}assets/screens/${name}`;
  return `<picture class="screenshot">
    <source srcset="${base}-dark.webp" media="(prefers-color-scheme: dark)">
    <img src="${base}-light.webp" width="${width}" height="${height}" alt="${escapeHtml(alt)}" ${isEager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
  </picture>`;
}

function header({ page, text }) {
  const home = langUrl({ ...page, pagePath: '' });
  const other = text.otherLang;
  return `<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="${home}">${BRAND_MARK}<span>Arca</span></a>
    <nav class="site-nav" aria-label="${text.nav.menu}">
      <a class="nav-optional" href="${home}#features">${text.nav.features}</a>
      <a class="nav-optional" href="${home}#how">${text.nav.how}</a>
      <a href="${langUrl({ ...page, pagePath: 'docs/quickstart/' })}">${text.nav.docs}</a>
      <a class="lang-switch" href="${langUrl({ ...page, lang: other.code })}" hreflang="${other.code}" lang="${other.code}" title="${other.title}">${other.label}</a>
      <a class="icon-link" href="${REPO_URL}" aria-label="GitHub">${icon('github')}</a>
    </nav>
  </div>
</header>`;
}

function footer({ page, text }) {
  return `<footer class="site-footer">
  <div class="container footer-inner">
    <a class="brand brand-small" href="${langUrl({ ...page, pagePath: '' })}">${BRAND_MARK}<span>Arca</span></a>
    <nav class="footer-nav">
      <a href="${langUrl({ ...page, pagePath: 'docs/quickstart/' })}">${text.footer.docs}</a>
      <a href="${REPO_URL}">GitHub</a>
      <a href="${REPO_URL}/blob/main/LICENSE">${text.footer.license}</a>
    </nav>
    <p class="footer-note">${text.footer.privacy}</p>
  </div>
</footer>`;
}

/** Full HTML document. page: { lang, root, pagePath }, body: inner HTML, scripts: paths under assets/. */
export function layout({ page, title, description, body, bodyClass = '', scripts = [] }) {
  const text = CONTENT[page.lang];
  const other = text.otherLang.code;
  return `<!doctype html>
<html lang="${text.htmlLang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="${CSP}">
  <meta name="referrer" content="no-referrer">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="color-scheme" content="light dark">
  <link rel="icon" href="${page.root}favicon.svg">
  <link rel="stylesheet" href="${page.root}assets/site.css">
  <link rel="alternate" hreflang="${other}" href="${langUrl({ ...page, lang: other })}">
${scripts.map((src) => `  <script type="module" src="${page.root}assets/${src}"></script>`).join('\n')}
</head>
<body class="${bodyClass}">
${header({ page, text })}
${body}
${footer({ page, text })}
</body>
</html>
`;
}

export { escapeHtml, langUrl };
