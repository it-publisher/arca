// Builds the static product site (landing + docs, ru and en) into _site/. Usage: npm run site:build
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CONTENT } from './content.js';
import { DOC_SLUGS, renderDoc, renderDocPage } from './docs.js';
import { renderLanding } from './landing.js';
import { layout } from './templates.js';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const SITE_DIR = import.meta.dirname;
const OUT_DIR = path.join(ROOT_DIR, '_site');
const LANGS = Object.keys(CONTENT);

/** page.root is the relative way back to the site root, so the site works under any base path. */
function createPage(lang, pagePath) {
  const fullPath = `${lang === 'en' ? 'en/' : ''}${pagePath}`;
  const depth = fullPath.split('/').filter(Boolean).length;
  return { lang, pagePath, root: '../'.repeat(depth) };
}

async function writePage(page, html) {
  const file = path.join(OUT_DIR, page.lang === 'en' ? 'en' : '', page.pagePath, 'index.html');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html);
}

async function copyAssets() {
  const assets = path.join(OUT_DIR, 'assets');
  await mkdir(assets, { recursive: true });
  await cp(path.join(SITE_DIR, 'assets'), assets, { recursive: true });
  await cp(path.join(SITE_DIR, 'site.css'), path.join(assets, 'site.css'));
  await cp(path.join(SITE_DIR, 'demo.js'), path.join(assets, 'demo.js'));
  // The demo runs the real Arca crypto module, not a copy of its logic.
  await cp(path.join(ROOT_DIR, 'shared', 'crypto.js'), path.join(assets, 'crypto.js'));
  await cp(path.join(ROOT_DIR, 'web', 'public', 'favicon.svg'), path.join(OUT_DIR, 'favicon.svg'));
  // GitHub Pages would otherwise run Jekyll and skip some files.
  await writeFile(path.join(OUT_DIR, '.nojekyll'), '');
}

async function buildDocs(lang) {
  const sources = await Promise.all(DOC_SLUGS.map((slug) => readFile(path.join(ROOT_DIR, 'docs', lang, `${slug}.md`), 'utf8')));
  const docs = DOC_SLUGS.map((slug, index) => renderDoc(sources[index], createPage(lang, `docs/${slug}/`)));
  const titles = Object.fromEntries(DOC_SLUGS.map((slug, index) => [slug, docs[index].title]));
  await Promise.all(DOC_SLUGS.map((slug, index) => {
    const page = createPage(lang, `docs/${slug}/`);
    return writePage(page, renderDocPage({ page, slug, doc: docs[index], titles }));
  }));
  // /docs/ itself has no content of its own: send readers to the first page.
  await writePage(createPage(lang, 'docs/'), `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${DOC_SLUGS[0]}/"><title>Arca</title>`);
}

// GitHub Pages serves 404.html at any depth, so it needs absolute links: the project site lives under /arca/.
const SITE_BASE = process.env.SITE_BASE ?? '/arca/';

async function buildNotFound() {
  const page = { lang: 'ru', pagePath: '', root: SITE_BASE };
  const t = CONTENT.ru.notFound;
  const body = `<main class="container not-found"><h1>404</h1><p class="lead">${t.title}. ${t.text}</p><a class="btn btn-primary" href="${SITE_BASE}">${t.home}</a></main>`;
  await writeFile(path.join(OUT_DIR, '404.html'), layout({ page, title: `${t.title} — Arca`, description: t.text, body }));
}

async function main() {
  await rm(OUT_DIR, { recursive: true, force: true });
  await copyAssets();
  for (const lang of LANGS) {
    await writePage(createPage(lang, ''), renderLanding(createPage(lang, '')));
    await buildDocs(lang);
  }
  await buildNotFound();
  console.info(`site built: ${path.relative(process.cwd(), OUT_DIR)}/`);
}

main().catch((error) => {
  console.error('Site build failed:', error);
  process.exit(1);
});
