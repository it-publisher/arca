import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { highlightCode, highlightMarkdownBlocks } from './highlight.js';
import { el } from './ui.js';

// <style> would restyle the whole page, <form> could imitate the login screen.
const FORBIDDEN_TAGS = ['style', 'form'];

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

function renderMarkdown(container, text) {
  container.innerHTML = DOMPurify.sanitize(marked.parse(text, { gfm: true }), { FORBID_TAGS: FORBIDDEN_TAGS });
  highlightMarkdownBlocks(container);
}

/** Code is shown, never run: escaped by highlight.js, sanitized again, with a line-number gutter. */
function renderCode(container, text, language) {
  const { html, language: usedLanguage } = highlightCode(text, language);
  const lineCount = text.replace(/\n$/, '').split('\n').length;
  const code = el('code', { className: 'hljs' });
  code.innerHTML = DOMPurify.sanitize(html);
  const gutter = el('pre', {
    className: 'code-gutter',
    textContent: Array.from({ length: lineCount }, (_, index) => index + 1).join('\n'),
  });
  gutter.setAttribute('aria-hidden', 'true');
  container.replaceChildren(el('div', { className: 'code-view' }, [gutter, el('pre', { className: 'code-body' }, [code])]));
  return usedLanguage;
}

function renderPlain(container, text) {
  container.replaceChildren(el('pre', { textContent: text }));
}

/** Returns the highlight language for code notes (useful when it was auto-detected), else null. */
export function renderNoteText(container, text, format, language) {
  container.classList.toggle('markdown-body', format === 'md');
  container.classList.toggle('plain-body', format === 'text');
  container.classList.toggle('code-body-wrap', format === 'code');
  if (format === 'md') renderMarkdown(container, text);
  if (format === 'text') renderPlain(container, text);
  if (format === 'code') return renderCode(container, text, language);
  return null;
}
