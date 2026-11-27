import { CONTENT, REPO_URL } from './content.js';
import { icon } from './icons.js';
import { escapeHtml, langUrl, layout, screenshot } from './templates.js';

function hero({ page, text }) {
  const { hero: t } = text;
  return `<section class="hero">
  <div class="container hero-copy">
    <p class="eyebrow">${t.eyebrow}</p>
    <h1>${t.title}</h1>
    <p class="lead">${t.lead}</p>
    <div class="actions">
      <a class="btn btn-primary" href="${langUrl({ ...page, pagePath: 'docs/quickstart/' })}">${t.primary}${icon('arrowRight')}</a>
      <a class="btn btn-secondary" href="#how">${t.secondary}</a>
      <a class="btn btn-ghost" href="${REPO_URL}">${icon('github')}GitHub</a>
    </div>
    <p class="hero-note">${t.note}</p>
  </div>
  <div class="container">
    <div class="window hero-window">
      <div class="window-bar"><span class="dots"><i></i><i></i><i></i></span><span class="address">arca.example.com</span></div>
      ${screenshot({ root: page.root, name: 'editor', alt: t.screenshotAlt, isEager: true })}
    </div>
  </div>
</section>`;
}

function scenarios({ text }) {
  const { scenarios: t } = text;
  return `<section class="section">
  <div class="container split">
    <div>
      <h2>${t.title}</h2>
      <p class="section-lead">${t.lead}</p>
    </div>
    <ol class="scenario-list">
      ${t.items.map((item) => `<li>${item}</li>`).join('\n      ')}
    </ol>
  </div>
</section>`;
}

function features({ text }) {
  const { features: t } = text;
  const cards = t.items.map((item) => `<article class="feature">
        <span class="feature-icon${item.icon === 'flame' ? ' is-burn' : ''}">${icon(item.icon)}</span>
        <h3>${item.title}</h3>
        <p>${item.text}</p>
      </article>`);
  return `<section class="section" id="features">
  <div class="container">
    <h2 class="center">${t.title}</h2>
    <div class="feature-grid">
      ${cards.join('\n      ')}
    </div>
  </div>
</section>`;
}

function showcase({ page, text }) {
  const rows = text.showcase.map((item, index) => `<div class="showcase-row${index % 2 ? ' is-reversed' : ''}">
      <div class="showcase-copy">
        <h3>${item.title}</h3>
        <p>${item.text}</p>
      </div>
      <div class="window">
        <div class="window-bar"><span class="dots"><i></i><i></i><i></i></span><span class="address">arca.example.com/n/…</span></div>
        ${screenshot({ root: page.root, name: item.image, alt: item.alt })}
      </div>
    </div>`);
  return `<section class="section">
  <div class="container showcase">
    ${rows.join('\n    ')}
  </div>
</section>`;
}

function demo({ text }) {
  const { demo: t } = text.how;
  return `<div class="demo" id="demo" data-sample="${escapeHtml(t.sample)}" data-bytes-label="${escapeHtml(t.bytes)}">
      <div class="demo-head">
        <h3>${t.title}</h3>
        <p class="muted">${t.hint}</p>
      </div>
      <label class="demo-field">
        <span>${t.input}</span>
        <textarea id="demo-input" rows="3" spellcheck="false">${escapeHtml(t.sample)}</textarea>
      </label>
      <div class="demo-output">
        <div class="demo-row">
          <span class="demo-label">${icon('key')}${t.key}</span>
          <code id="demo-key" class="demo-value is-key">…</code>
          <button id="demo-regenerate" class="btn btn-small btn-secondary" type="button">${icon('refresh')}${t.regenerate}</button>
        </div>
        <div class="demo-row">
          <span class="demo-label">${icon('server')}${t.cipher}<span id="demo-size" class="muted"></span></span>
          <code id="demo-cipher" class="demo-value is-cipher">…</code>
        </div>
        <div class="demo-row">
          <span class="demo-label">${icon('arrowRight')}${t.link}</span>
          <code class="demo-value is-link"><span id="demo-link-base">https://arca.example.com/n/…</span><span id="demo-link-key" class="link-key"></span></code>
        </div>
        <div class="demo-row">
          <span class="demo-label">${icon('check')}${t.decrypted}</span>
          <output id="demo-decrypted" class="demo-value is-plain">…</output>
        </div>
      </div>
      <noscript><p class="muted">${t.noScript}</p></noscript>
    </div>`;
}

function how({ page, text }) {
  const { how: t } = text;
  const steps = t.steps.map((step, index) => `<li class="flow-step">
        <span class="flow-icon">${icon(step.icon)}</span>
        <strong>${index + 1}. ${step.title}</strong>
        <span>${step.text}</span>
      </li>`);
  return `<section class="section section-tinted" id="how">
  <div class="container">
    <h2 class="center">${t.title}</h2>
    <p class="section-lead center narrow">${t.lead}</p>
    <ol class="flow">
      ${steps.join('\n      ')}
    </ol>
    <div class="anatomy" aria-hidden="true">
      <code><span class="anatomy-sent">https://arca.example.com/n/q3Zr8xKpL0a</span><span class="anatomy-kept">#hR7mX2…Vb2</span></code>
      <div class="anatomy-labels"><span class="anatomy-sent">↑ ${t.anatomy.sent}</span><span class="anatomy-kept">↑ ${t.anatomy.kept}</span></div>
    </div>
    ${demo({ text })}
    <p class="center"><a class="text-link" href="${langUrl({ ...page, pagePath: 'docs/how-it-works/' })}">${t.more}${icon('arrowRight')}</a></p>
  </div>
</section>`;
}

function cli({ page, text }) {
  const { cli: t } = text;
  const lines = t.terminal.map((line) => `<span class="prompt">$</span> ${escapeHtml(line.cmd)}\n<span class="out">${escapeHtml(line.out)}</span>`);
  return `<section class="section">
  <div class="container split split-wide">
    <div>
      <h2>${t.title}</h2>
      <p class="section-lead">${t.lead}</p>
      <ul class="check-list">
        ${t.points.map((point) => `<li>${icon('terminal')}<span>${point}</span></li>`).join('\n        ')}
      </ul>
      <a class="text-link" href="${langUrl({ ...page, pagePath: 'docs/cli/' })}">${t.more}${icon('arrowRight')}</a>
    </div>
    <div class="terminal">
      <div class="window-bar"><span class="dots"><i></i><i></i><i></i></span><span class="address">zsh</span></div>
      <pre>${lines.join('\n\n')}</pre>
    </div>
  </div>
</section>`;
}

function philosophy({ text }) {
  const { philosophy: t } = text;
  const list = (items, iconName) => items.map((item) => `<li>${icon(iconName)}<span>${item}</span></li>`).join('\n          ');
  return `<section class="section">
  <div class="container">
    <h2 class="center">${t.title}</h2>
    <p class="section-lead center narrow">${t.lead}</p>
    <div class="compare">
      <div class="compare-card is-yes">
        <h3>${t.isTitle}</h3>
        <ul>
          ${list(t.is, 'check')}
        </ul>
      </div>
      <div class="compare-card is-no">
        <h3>${t.notTitle}</h3>
        <ul>
          ${list(t.not, 'x')}
        </ul>
      </div>
    </div>
  </div>
</section>`;
}

function cta({ page, text }) {
  const { cta: t } = text;
  return `<section class="section section-tight-top">
  <div class="container">
    <div class="cta">
      <h2>${t.title}</h2>
      <p>${t.lead}</p>
      <div class="actions">
        <a class="btn btn-primary" href="${langUrl({ ...page, pagePath: 'docs/deploy/' })}">${t.primary}${icon('arrowRight')}</a>
        <a class="btn btn-secondary" href="${langUrl({ ...page, pagePath: 'docs/quickstart/' })}">${t.secondary}</a>
      </div>
    </div>
  </div>
</section>`;
}

export function renderLanding(page) {
  const text = CONTENT[page.lang];
  const sections = [hero, scenarios, features, showcase, how, cli, philosophy, cta].map((render) => render({ page, text }));
  return layout({
    page,
    title: text.meta.title,
    description: text.meta.description,
    body: `<main>\n${sections.join('\n\n')}\n</main>`,
    bodyClass: 'is-landing',
    scripts: ['demo.js'],
  });
}
