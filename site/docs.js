import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import ini from 'highlight.js/lib/languages/ini';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import vim from 'highlight.js/lib/languages/vim';
import { Marked } from 'marked';
import { CONTENT, DOCS_NAV, REPO_URL } from './content.js';
import { icon } from './icons.js';
import { escapeHtml, langUrl, layout, screenshot } from './templates.js';

for (const [name, language] of Object.entries({ bash, ini, javascript, json, vim })) hljs.registerLanguage(name, language);

export const DOC_SLUGS = DOCS_NAV.flatMap((section) => section.slugs);

/** "Одноразовые заметки" → "одноразовые-заметки": the same anchors the docs link to. */
export function slugify(text) {
  return text.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
}

/** Docs link with root-absolute paths ("/docs/cli/", "/assets/…"); they are rewritten relative to each page. */
function resolveHref(href, page) {
  if (href.startsWith('/docs/')) return langUrl({ ...page, pagePath: href.slice(1) });
  if (href.startsWith('/')) return `${page.root}${href.slice(1)}`;
  return href;
}

/** Renders one docs Markdown file; returns its title, HTML and the H2 table of contents. */
export function renderDoc(markdown, page) {
  const toc = [];
  let title = '';
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth, text }) {
        const html = this.parser.parseInline(tokens);
        if (depth === 1) {
          title = text;
          return `<h1>${html}</h1>\n`;
        }
        const id = slugify(text);
        if (depth === 2) toc.push({ id, html });
        return `<h${depth} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true">#</a>${html}</h${depth}>\n`;
      },
      link({ href, title: linkTitle, tokens }) {
        const isExternal = /^https?:/.test(href);
        const attrs = isExternal ? ' rel="noopener noreferrer"' : '';
        const titleAttr = linkTitle ? ` title="${escapeHtml(linkTitle)}"` : '';
        return `<a href="${escapeHtml(resolveHref(href, page))}"${titleAttr}${attrs}>${this.parser.parseInline(tokens)}</a>`;
      },
      image({ href, text }) {
        // Screenshots come in light and dark variants: /assets/screens/<name>-light.webp
        const match = href.match(/^\/assets\/screens\/(\w+)-light\.webp$/);
        if (!match) throw new Error(`Unsupported image in docs: ${href}`);
        return screenshot({ root: page.root, name: match[1], alt: text });
      },
      code({ text, lang }) {
        const language = (lang ?? '').trim();
        const html = hljs.getLanguage(language) ? hljs.highlight(text, { language }).value : escapeHtml(text);
        return `<pre class="code-block"><code class="hljs">${html}</code></pre>\n`;
      },
    },
  });
  const html = marked.parse(markdown);
  if (!title) throw new Error(`Doc ${page.pagePath} has no H1 title`);
  return { title, html, toc };
}

function sidebar({ page, titles, slug }) {
  const groups = DOCS_NAV.map((section) => {
    const links = section.slugs.map((item) => {
      const current = item === slug ? ' aria-current="page"' : '';
      return `<li><a href="${langUrl({ ...page, pagePath: `docs/${item}/` })}"${current}>${titles[item]}</a></li>`;
    });
    return `<div class="docs-nav-group">
        <p class="docs-nav-title">${section.group[page.lang]}</p>
        <ul>${links.join('')}</ul>
      </div>`;
  });
  return `<nav class="docs-nav" aria-label="${CONTENT[page.lang].docs.title}">\n      ${groups.join('\n      ')}\n    </nav>`;
}

function pager({ page, titles, slug }) {
  const t = CONTENT[page.lang].docs;
  const index = DOC_SLUGS.indexOf(slug);
  const link = (target, label, className) => (target
    ? `<a class="pager-link ${className}" href="${langUrl({ ...page, pagePath: `docs/${target}/` })}"><span>${label}</span>${titles[target]}</a>`
    : '<span></span>');
  return `<nav class="pager">${link(DOC_SLUGS[index - 1], t.prev, 'is-prev')}${link(DOC_SLUGS[index + 1], t.next, 'is-next')}</nav>`;
}

export function renderDocPage({ page, slug, doc, titles }) {
  const t = CONTENT[page.lang].docs;
  const toc = doc.toc.length > 1
    ? `<aside class="docs-toc"><p class="docs-nav-title">${t.onThisPage}</p><ul>${doc.toc.map((item) => `<li><a href="#${item.id}">${item.html}</a></li>`).join('')}</ul></aside>`
    : '<aside class="docs-toc"></aside>';
  const editUrl = `${REPO_URL}/edit/main/docs/${page.lang}/${slug}.md`;
  const body = `<main class="container docs-layout">
    ${sidebar({ page, titles, slug })}
    <article class="docs-content">
      <div class="prose">
${doc.html}
      </div>
      <a class="edit-link" href="${editUrl}">${icon('github')}${t.edit}</a>
      ${pager({ page, titles, slug })}
    </article>
    ${toc}
  </main>`;
  return layout({
    page,
    title: `${doc.title} — Arca`,
    description: CONTENT[page.lang].meta.description,
    body,
    bodyClass: 'is-docs',
  });
}
