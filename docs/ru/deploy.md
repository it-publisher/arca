# Деплой на VPS

Ставим Arca на свой сервер с HTTPS. Фронтенд собирается на твоём компьютере, на сервере нужны только Node и Caddy. Пример — Ubuntu 24.04.

## Что понадобится

| Что | Минимум |
|---|---|
| VPS | 1 vCPU, 512 МБ RAM. Сам сервис занимает около 30 МБ памяти |
| Домен | Любой субдомен, например `arca.example.com` |
| Доступ | SSH по ключу под `root` или пользователем с `sudo` |
| Локально | Node 22.13+ и клон репозитория (см. [Быстрый старт](/docs/quickstart/)) |

⚠️ HTTPS обязателен: браузеры не дают WebCrypto на голом `http://IP`, и шифрование не заработает.

Удобно завести хост в `~/.ssh/config`, тогда все команды ниже работают как есть:

```text
Host arca
  HostName 203.0.113.10
  User root
  IdentityFile ~/.ssh/arca
```

## 1. DNS

Создай A-запись субдомена на IP сервера:

```text
arca.example.com.  A  203.0.113.10
```

- Если DNS в Cloudflare — режим «DNS only», без проксирования
- Если у домена есть CAA-записи, в них должен быть `letsencrypt.org`

Проверка: `dig +short arca.example.com` возвращает IP сервера.

## 2. Защитить сервер

На сервере:

```bash
# SSH только по ключу. Префикс 00- нужен, чтобы перекрыть 50-cloud-init.conf
printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin prohibit-password\n' \
  > /etc/ssh/sshd_config.d/00-hardening.conf
sshd -t && systemctl reload ssh

# Файрвол: только SSH и веб
ufw default deny incoming
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443
ufw --force enable
```

⚠️ Прежде чем закрыть текущую сессию, проверь вход по ключу в **новом** окне терминала.

## 3. Установить Node и Caddy

```bash
install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
  | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" \
  > /etc/apt/sources.list.d/nodesource.list

curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
  > /etc/apt/sources.list.d/caddy-stable.list

apt update && apt install -y nodejs caddy sqlite3 rsync
```

## 4. Пользователь и папки

```bash
useradd --system --home-dir /opt/arca --no-create-home --shell /usr/sbin/nologin arca
install -d -o root -g root -m 0755 /opt/arca
install -d -o arca -g arca -m 0700 /opt/arca/data
```

Код принадлежит `root`, сервис запускается от `arca` и может писать только в `data`.

## 5. Залить код

На своём компьютере, из папки проекта:

```bash
npm run build
rsync -a --delete --chown=root:root \
  --include='/package.json' --include='/server/***' --include='/shared/***' \
  --include='/dist/***' --include='/deploy/***' --exclude='*' ./ arca:/opt/arca/
```

## 6. Настроить и запустить

На сервере:

```bash
cat > /opt/arca/.env <<'ENV'
ARCA_USERS=
ARCA_HOST=127.0.0.1
ARCA_PORT=3000
ARCA_DATA_DIR=/opt/arca/data
ENV
chown root:arca /opt/arca/.env && chmod 640 /opt/arca/.env

cp /opt/arca/deploy/arca.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable arca
ln -sf /opt/arca/deploy/arca-user.sh /usr/local/bin/arca-user
```

| Команда | Что делает |
|---|---|
| `cat > /opt/arca/.env …` | Создаёт файл настроек. Список пользователей пока пуст |
| `chown …`, `chmod 640` | Файл могут читать только root и сервис Arca |
| `cp …`, `systemctl enable` | Регистрирует сервис и включает автозапуск |
| `ln -sf …` | Подключает команду `arca-user`. При обновлении Arca она обновится сама |

Теперь со своего компьютера создай первого пользователя — себя:

```bash
ssh arca arca-user add me | pbcopy
```

Скрипт создаст токен, запустит Arca и положит код доступа в буфер обмена. Сохрани код в менеджере паролей: это твой вход. Остальных людей добавишь так же — см. [Пользователи и коды доступа](/docs/users/).

## 7. HTTPS через Caddy

```bash
cp /opt/arca/deploy/Caddyfile /etc/caddy/Caddyfile
sed -i 's/arca.example.com/твой.домен/' /etc/caddy/Caddyfile
systemctl reload caddy
```

Caddy сам получит сертификат Let's Encrypt за несколько секунд.

## 8. Проверить

```bash
systemctl status arca --no-pager          # active (running)
curl -sI https://твой.домен | head -1     # HTTP/2 200
```

Открой адрес в браузере и войди кодом доступа из шага 6.

## Дальше

- [Обновление и бэкап](/docs/maintenance/): ежедневные снимки и выкладка новых версий
- [CLI](/docs/cli/): `arca login` с адресом сервера
