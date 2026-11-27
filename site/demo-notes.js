// Fictional content for site screenshots: no real people, projects or links.
import { EXPIRY_SECONDS } from '../shared/note.js';

const ARTICLE = `# План материала: open source в госсекторе

Черновик к среде, вычитка — в четверг, публикация в пятницу.

## Тезисы

1. Что изменилось за год: реестры ПО и требования к закупкам
2. Кто реально контрибьютит, а кто только форкает
3. Где открытый код экономит бюджет, а где нет

## Источники

| Источник | Что берём | Статус |
|---|---|---|
| Открытые реестры ПО | Число open source-продуктов | ✅ выгружено |
| GitHub API | Активность репозиториев | ⏳ в работе |
| Интервью | 3 разработчика, 1 заказчик | ❌ не начато |

## Задачи

- [x] Собрать выгрузку репозиториев
- [ ] Посчитать медианы по организациям
- [ ] Отправить вопросы спикерам

> Каждую цифру проверяем по двум источникам, прежде чем писать вывод.

\`\`\`bash
curl -s "https://api.github.com/orgs/example/repos?per_page=100" | jq length
\`\`\`
`;

const SCRIPT = `"""Медианная активность репозиториев по организациям."""
import json
import statistics
from pathlib import Path

DATA_DIR = Path("data")


def load_repos(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as file:
        return json.load(file)


def median_commits(repos: list[dict]) -> float:
    counts = [repo["commits_last_year"] for repo in repos if not repo["fork"]]
    return statistics.median(counts) if counts else 0.0


if __name__ == "__main__":
    for org_file in sorted(DATA_DIR.glob("*.json")):
        repos = load_repos(org_file)
        print(f"{org_file.stem:<24} {median_commits(repos):>8.1f}")
`;

const LOG = `2026-11-27T09:14:02Z INFO  server listening on :8080
2026-11-27T09:14:05Z WARN  slow query: 1840ms SELECT * FROM repos
2026-11-27T09:14:07Z ERROR upstream timeout after 30s
`;

export const DEMO_NOTES = [
  { name: 'log', options: { text: LOG, format: 'code', language: 'plaintext', expiresIn: EXPIRY_SECONDS['1d'] } },
  { name: 'secret', options: { text: 'Доступ к тестовому стенду', format: 'text', burnAfterRead: true, expiresIn: EXPIRY_SECONDS['1w'] } },
  { name: 'script', options: { text: SCRIPT, format: 'code', language: 'python', expiresIn: EXPIRY_SECONDS['1w'] } },
  { name: 'article', options: { text: ARTICLE, format: 'md', expiresIn: EXPIRY_SECONDS['30d'] } },
];

export const DEMO_DRAFT = {
  format: 'md',
  language: 'auto',
  text: `# Интервью: как живёт open source-команда

## Вопросы

1. С чего начался проект и кто его поддерживает сейчас?
2. Сколько контрибьюторов приходит извне?
3. Как вы решаете, что принимать в main?

## Заметки с созвона

- Релиз раз в две недели, CI на своём железе
- **Главная боль** — документация, а не код
- Доклад с конференции: https://example.com/talk
`,
};
