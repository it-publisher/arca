// Syntax highlighting only: highlight.js escapes the text and wraps tokens in <span>s, nothing is executed.
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import go from 'highlight.js/lib/languages/go';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import nginx from 'highlight.js/lib/languages/nginx';
import php from 'highlight.js/lib/languages/php';
import plaintext from 'highlight.js/lib/languages/plaintext';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { AUTO_LANGUAGE } from '../../shared/languages.js';

const MODULES = {
  plaintext, bash, javascript, typescript, json, xml, css, python, sql, yaml,
  markdown, diff, go, rust, java, php, c, cpp, dockerfile, nginx, ini,
};
for (const [id, definition] of Object.entries(MODULES)) hljs.registerLanguage(id, definition);

// Auto-detection over huge logs would freeze the tab; beyond this they are shown unhighlighted.
const MAX_HIGHLIGHT_CHARS = 200_000;
const AUTO_CANDIDATES = Object.keys(MODULES).filter((id) => id !== 'plaintext');

/** Returns escaped, highlighted HTML and the language actually used. */
export function highlightCode(text, language = AUTO_LANGUAGE) {
  if (text.length > MAX_HIGHLIGHT_CHARS) {
    return { html: hljs.highlight(text, { language: 'plaintext' }).value, language: 'plaintext' };
  }
  if (language !== AUTO_LANGUAGE && hljs.getLanguage(language)) {
    return { html: hljs.highlight(text, { language }).value, language };
  }
  const result = hljs.highlightAuto(text, AUTO_CANDIDATES);
  return { html: result.value, language: result.language ?? 'plaintext' };
}

/** Highlights ```lang blocks inside rendered Markdown; blocks without a known language stay plain. */
export function highlightMarkdownBlocks(container) {
  for (const code of container.querySelectorAll('pre code[class*="language-"]')) {
    const name = [...code.classList].find((cls) => cls.startsWith('language-')).slice('language-'.length);
    if (hljs.getLanguage(name)) code.innerHTML = hljs.highlight(code.textContent, { language: name }).value;
  }
}
