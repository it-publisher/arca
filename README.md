# Arca

Сервис для быстрых заметок, которыми можно поделиться. Записал мысль, пост, правку или задачу, кинул скриншот — получил ссылку. Заметка живёт 30 дней и сгорает. Всё шифруется на клиенте: сервер на своём VPS не видит ни текста, ни файлов, ни заголовков.

---

## Для кого

- Пишут: ты и пара доверенных людей, у каждого свой код доступа
- Читают: все, кому отправили ссылку, без регистрации и аккаунтов

## Типичные сценарии

- Отправить черновик или фрагмент статьи коллеге на вычитку
- Поделиться находкой из OSINT-исследования, таблицей или выгрузкой, не оставляя её в мессенджере
- Передать скриншот или PDF, который сам исчезнет через день или неделю
- Опубликовать заметку прямо из nvim или терминала
- Дать ИИ-агенту способ отдавать результат ссылкой

---

## Возможности

- Markdown, **код с подсветкой синтаксиса** (20 языков + автоопределение, номера строк) и обычный текст, предпросмотр. Код только показывается, никогда не исполняется
- До 10 файлов по 50 МБ: drag-n-drop, вставка из буфера (⌘V), выбор через диалог
- Срок жизни: 1 час / 1 день / 1 неделя / **30 дней (по умолчанию)** / бессрочно, счётчик «🔥 N дней»
- **Сжечь после прочтения** — открывается один раз по кнопке; превью мессенджеров и сканеры ссылок заметку не сжигают
- Автосохранение черновика — в браузере и в CLI
- «Мои заметки» — общий список для всех браузеров и CLI, зашифрованный
- Правка заметки на месте (только автор, ссылка не меняется), поделиться, копировать, скачать как `.md`
- CLI `arca` и скриншот по горячей клавише → ссылка в буфере
- Светлая и тёмная тема по системе

---

## Как это работает

### Шифрование заметок

1. Клиент (браузер или CLI) генерирует случайный ключ AES-256-GCM
2. Текст и каждый файл шифруются на клиенте
3. На сервер уходят только зашифрованные байты
4. Ключ кладётся в ссылку после `#`: `https://arca.example.com/n/<id>#<ключ>`

Часть после `#` браузер не отправляет на сервер. Даже с полным доступом к VPS и базе прочитать заметки нельзя.

⚠️ Потерял ссылку и код доступа — потерял заметку.

### Код доступа

Код доступа — `<токен>.<ключ истории>`, одна строка на человека.

| Часть | Где живёт | Что даёт |
|---|---|---|
| Токен | На сервере (`ARCA_USERS`) и на устройстве | Право создавать и удалять свои заметки |
| Ключ истории | **Только на устройстве** | Расшифровку списка «Мои заметки» |

При создании заметки клиент шифрует ключом истории запись «ключ заметки + заголовок» и сохраняет её рядом с заметкой. Любое устройство с тем же кодом получает список и расшифровывает его локально. Заметка сгорела — запись исчезает вместе с ней.

⚠️ Код открывает все твои живые заметки — храни его как пароль.

---

## Быстрый старт (локально)

```bash
npm install
npm run token                                   # токен для ARCA_USERS
cp .env.example .env                            # вписать: ARCA_USERS=me:<токен>
npm run build
npm start                                       # http://127.0.0.1:3000
echo "<токен>" | npm run -s access-code         # код доступа для входа
```

Разработка — в двух терминалах: `npm run dev:web` и `npm run dev:server`. Тесты: `npm test`.

Требования: Node ≥ 22.13 (нужен встроенный `node:sqlite`).

---

## Веб

- `/` — редактор: текст, файлы, срок жизни, «Сжечь после прочтения», «Мои заметки»
- `/n/<id>#<ключ>` — просмотр, без входа. Иконки: ✏️ править (только автор), поделиться ссылкой, копировать текст, скачать
- `/login` — вход по коду доступа

⌘/Ctrl + Enter — создать ссылку, она сразу копируется в буфер.

---

## CLI

```bash
npm link                      # команда arca станет доступна глобально
arca login                    # адрес сервера + код доступа → ~/.config/arca/config.json (0600)
```

| Команда | Что делает |
|---|---|
| `arca` | Открыть `$EDITOR`, после `:wq` — ссылка |
| `arca note.md` | Опубликовать файл: `.md` — Markdown, `.py` `.sh` `.html` `.json` `.diff` `.log` и др. — код с подсветкой, остальное — текст |
| `echo "текст" \| arca` | Опубликовать stdin |
| `arca get '<url>'` | Расшифровать заметку в stdout |
| `arca get '<url>' -o dir` | …и сохранить вложения |
| `arca ls` | Мои заметки: `url`, срок, заголовок (TSV) |
| `arca rm '<url>'` | Удалить заметку |

| Флаг | Значение |
|---|---|
| `-a, --attach <file>` | Приложить файл (можно несколько раз) |
| `-e, --expires <ttl>` | `1h`, `1d`, `1w`, `30d` (по умолчанию), `never` |
| `-b, --burn` | Сжечь после прочтения |
| `-t, --text` | Обычный текст вместо Markdown |
| `-l, --lang <id>` | Код с подсветкой: `auto`, `bash`, `python`, `javascript`, `xml` (HTML), `json`, `sql`, `diff`… (`arca -h` — весь список) |

Ссылки в командах — в одинарных кавычках: zsh спотыкается о `#`.

Переменные `ARCA_URL` и `ARCA_CODE` перекрывают конфиг. `EDITOR` — редактор (`nvim`, `zed --wait`).

Черновик режима редактора живёт в `~/.local/state/arca/draft.md` (права 600) до публикации. Закрыл терминал посреди набора — снова `arca`, и текст на месте; несохранённое nvim предложит восстановить из swap.

Примеры:

```bash
arca | pbcopy                         # ссылка сразу в буфер
git diff | arca -l diff -e 1w         # поделиться диффом на неделю
journalctl -u app -n 200 | arca -l plaintext   # лог с номерами строк
arca get '<url>' > note.md            # заметку — в файл (например, в Obsidian)
```

В nvim: `:w !arca` — опубликовать буфер, `:r !arca get '<url>'` — вставить заметку.

---

## Скриншот по горячей клавише (macOS)

`scripts/arca-shot.sh`: выделяешь область экрана → скриншот шифруется и загружается → ссылка в буфере, уведомление. Esc — отмена. Нужен выполненный `arca login`.

1. «Быстрые команды» → **+** → действие **«Запустить скрипт оболочки»**
2. Текст скрипта — полный путь к `scripts/arca-shot.sh`
3. **ⓘ** → **«Добавить быстрое сокращение клавиш»**, например `⌃⌥⌘A`
4. Настройки «Быстрых команд» → «Дополнения» → **«Разрешить запуск скриптов»**
5. При первом запуске macOS попросит доступ к **записи экрана** — разрешить

Срок жизни скриншотов: переменная `ARCA_SHOT_EXPIRES` (по умолчанию `30d`).

---

## Пользователи и коды доступа

Пользователи задаются в `.env` на сервере: `ARCA_USERS=name:token,name2:token2`.

| Задача | Как |
|---|---|
| Добавить пользователя | `npm run token` → дописать `name:<токен>` в `ARCA_USERS` → `systemctl restart arca` |
| Выдать код доступа | `ssh <host> "sed -nE 's/.*name:([^,]+).*/\1/p' /opt/arca/.env" \| npm run -s access-code \| pbcopy` |
| Отозвать доступ | Удалить пользователя из `ARCA_USERS` → `systemctl restart arca` |
| Код утёк | Новый токен для пользователя + новый код. Старые заметки пропадут из списка, но сгорят по сроку как обычно |

⚠️ Генерируй код **один раз** на человека: новый код = новый ключ истории, заметки со старым ключом в списке не появятся (будут помечены как «созданы с другим кодом доступа»).

---

## Деплой на VPS

Сервер без внешних зависимостей: фронт собирается локально, на VPS нужен только Node и Caddy. Пример — Ubuntu 24.04, SSH-хост `arca` в `~/.ssh/config`.

### 1. DNS

A-запись субдомена → IP VPS. HTTPS обязателен: WebCrypto не работает на голом `http://IP`.

```text
arca.example.com.  A  203.0.113.10
```

Если DNS в Cloudflare — без проксирования («DNS only»). Если у домена есть CAA-записи — в них должен быть `letsencrypt.org`.

### 2. Базовая защита

```bash
# SSH только по ключу (00- — чтобы перекрыть 50-cloud-init.conf)
printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin prohibit-password\n' \
  > /etc/ssh/sshd_config.d/00-hardening.conf
sshd -t && systemctl reload ssh          # проверить вход по ключу в НОВОМ окне до выхода

ufw default deny incoming && ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443 && ufw --force enable
```

### 3. Node и Caddy

```bash
install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" \
  > /etc/apt/sources.list.d/nodesource.list

curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list

apt update && apt install -y nodejs caddy sqlite3 rsync
```

### 4. Arca

На сервере:

```bash
useradd --system --home-dir /opt/arca --no-create-home --shell /usr/sbin/nologin arca
install -d -o root -g root -m 0755 /opt/arca
install -d -o arca -g arca -m 0700 /opt/arca/data
```

Локально — собрать и залить (код принадлежит root, сервис не может его изменить):

```bash
npm run build
rsync -a --delete --chown=root:root \
  --include='/package.json' --include='/server/***' --include='/shared/***' \
  --include='/dist/***' --include='/deploy/***' --exclude='*' ./ arca:/opt/arca/
```

На сервере — `.env`, systemd и Caddy:

```bash
cat > /opt/arca/.env <<'EOF'
ARCA_USERS=me:<токен>,friend:<токен>
ARCA_HOST=127.0.0.1
ARCA_PORT=3000
ARCA_DATA_DIR=/opt/arca/data
EOF
chown root:arca /opt/arca/.env && chmod 640 /opt/arca/.env

cp /opt/arca/deploy/arca.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now arca

cp /opt/arca/deploy/Caddyfile /etc/caddy/Caddyfile     # заменить домен
systemctl reload caddy                                 # сертификат Let's Encrypt — автоматически
```

### 5. Бэкап

`deploy/arca-backup.sh` — ежедневный снимок базы и файлов, хранится 7 дней, неизменённые файлы — жёсткими ссылками.

```bash
install -m 755 /opt/arca/deploy/arca-backup.sh /usr/local/bin/arca-backup
echo '30 3 * * * root /usr/local/bin/arca-backup' > /etc/cron.d/arca-backup
```

Снимки лежат в `/var/backups/arca` на том же сервере — это защита от ошибок, но не от потери VPS. Содержимое зашифровано, поэтому копию можно забирать куда угодно (`rsync` на свою машину).

---

## Обновление

```bash
npm test && npm run build
ssh arca /usr/local/bin/arca-backup                  # перед изменениями схемы БД
rsync -a --delete --chown=root:root \
  --include='/package.json' --include='/server/***' --include='/shared/***' \
  --include='/dist/***' --include='/deploy/***' --exclude='*' ./ arca:/opt/arca/
ssh arca systemctl restart arca
```

Миграции схемы применяются автоматически при старте.

---

## API

Всё, что передаётся, — шифротекст в base64url. Авторизация — `Authorization: Bearer <токен>`.

| Метод | Путь | Авторизация | Что делает |
|---|---|---|---|
| `POST` | `/api/files` | ✅ | Загрузить зашифрованный файл (`application/octet-stream`) → `{ id }` |
| `POST` | `/api/notes` | ✅ | Создать заметку: `payload`, `ownerEntry`, `files`, `expiresIn`, `burnAfterRead` → `{ id }` |
| `GET` | `/api/notes` | ✅ | Мои живые заметки с зашифрованными записями истории |
| `GET` | `/api/notes/:id` | — | Заметка; для одноразовой — только флаг, без содержимого |
| `POST` | `/api/notes/:id/open` | — | Открыть одноразовую заметку (и сжечь) |
| `PUT` | `/api/notes/:id` | ✅ | Изменить свою заметку: новые `payload` и `ownerEntry` тем же ключом (кроме одноразовых) |
| `DELETE` | `/api/notes/:id` | ✅ | Удалить свою заметку |
| `GET` | `/api/files/:id` | — | Скачать зашифрованный файл |
| `GET` | `/api/me` | ✅ | Проверить токен → `{ user }` |

Клиент со всей криптографией — `shared/client.js`, работает и в браузере, и в Node.

---

## Безопасность

- Создавать заметки могут только пользователи из `ARCA_USERS`, читать — все, у кого есть ссылка
- Ключ истории не покидает устройство; утечка базы не раскрывает ни содержимое, ни заголовки, ни ключи заметок
- Одноразовые заметки отдаются только через `POST`: `GET` содержимое не раскрывает
- Сервер отдаёт файлы только как `application/octet-stream` — SVG/HTML не исполнятся
- Markdown санитизируется DOMPurify, строгий CSP без inline-скриптов
- Внешние картинки в Markdown заблокированы CSP — читатель не светит IP третьим сайтам
- `Referrer-Policy: no-referrer`, `noindex` на всех страницах, Caddy не пишет access-лог
- systemd-сервис изолирован: пишет только в `/opt/arca/data`, без доступа к `/home`, устройствам и ядру
- Код доступа и черновик хранятся в `localStorage` — на чужом компьютере жми «Выйти»

---

## Стек и структура

| Часть | Технологии |
|---|---|
| Сервер | Node, `node:http`, `node:sqlite` — **0 зависимостей** |
| Фронт | Vanilla JS, Vite, `marked` + `DOMPurify` + `highlight.js` (вшиваются в бандл) |
| Крипто | WebCrypto (встроен в браузеры и Node) |
| Хранилище | SQLite (метаданные и шифротекст заметок), файлы на диске |
| HTTPS | Caddy + Let's Encrypt |

```text
server/    HTTP API, хранилище и миграции, статика
shared/    крипто, формат заметок, языки подсветки, API-клиент — общие для браузера и CLI
web/       страницы: редактор, просмотр, вход
cli/       arca
scripts/   arca-shot.sh (скриншот → ссылка), access-code.js (токен → код доступа)
deploy/    Caddyfile, arca.service, arca-backup.sh
test/      node:test — API, шифрование, одноразовые заметки, история
```

---

## Лицензия

[MIT](LICENSE)
