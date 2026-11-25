// Languages for "code" notes. Ids are highlight.js names; extensions drive CLI detection and downloads.
export const AUTO_LANGUAGE = 'auto';

export const LANGUAGES = Object.freeze([
  { id: 'plaintext', label: 'Без подсветки', extensions: ['log'] },
  { id: 'bash', label: 'Bash / Shell', extensions: ['sh', 'bash', 'zsh'] },
  { id: 'javascript', label: 'JavaScript', extensions: ['js', 'mjs', 'cjs', 'jsx'] },
  { id: 'typescript', label: 'TypeScript', extensions: ['ts', 'tsx'] },
  { id: 'json', label: 'JSON', extensions: ['json'] },
  { id: 'xml', label: 'HTML / XML', extensions: ['html', 'htm', 'xml', 'svg'] },
  { id: 'css', label: 'CSS', extensions: ['css'] },
  { id: 'python', label: 'Python', extensions: ['py'] },
  { id: 'sql', label: 'SQL', extensions: ['sql'] },
  { id: 'yaml', label: 'YAML', extensions: ['yaml', 'yml'] },
  { id: 'markdown', label: 'Markdown (исходник)', extensions: [] },
  { id: 'diff', label: 'Diff', extensions: ['diff', 'patch'] },
  { id: 'go', label: 'Go', extensions: ['go'] },
  { id: 'rust', label: 'Rust', extensions: ['rs'] },
  { id: 'java', label: 'Java', extensions: ['java'] },
  { id: 'php', label: 'PHP', extensions: ['php'] },
  { id: 'c', label: 'C', extensions: ['c', 'h'] },
  { id: 'cpp', label: 'C++', extensions: ['cpp', 'cc', 'hpp'] },
  { id: 'dockerfile', label: 'Dockerfile', extensions: ['dockerfile'] },
  { id: 'nginx', label: 'Nginx', extensions: ['conf'] },
  { id: 'ini', label: 'INI / TOML', extensions: ['ini', 'toml', 'env'] },
]);

const BY_ID = new Map(LANGUAGES.map((language) => [language.id, language]));
const BY_EXTENSION = new Map(LANGUAGES.flatMap((language) => language.extensions.map((ext) => [ext, language.id])));

export const isKnownLanguage = (id) => id === AUTO_LANGUAGE || BY_ID.has(id);
export const getLanguageLabel = (id) => BY_ID.get(id)?.label ?? id;

/** "script.py" → "python", "Dockerfile" → "dockerfile", unknown → null. */
export function languageFromFileName(fileName) {
  const base = fileName.split('/').pop().toLowerCase();
  if (base === 'dockerfile') return 'dockerfile';
  const extension = base.includes('.') ? base.split('.').pop() : '';
  return BY_EXTENSION.get(extension) ?? null;
}

export const extensionForLanguage = (id) => BY_ID.get(id)?.extensions[0] ?? 'txt';
