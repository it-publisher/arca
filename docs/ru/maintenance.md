# Обновление и бэкап

## Обновление

На своём компьютере, из папки проекта:

```bash
git pull
npm install
npm test && npm run build
ssh arca /usr/local/bin/arca-backup        # снимок перед выкладкой
rsync -a --delete --chown=root:root \
  --include='/package.json' --include='/server/***' --include='/shared/***' \
  --include='/dist/***' --include='/deploy/***' --exclude='*' ./ arca:/opt/arca/
ssh arca systemctl restart arca
```

Миграции схемы базы применяются автоматически при старте. Данные в `/opt/arca/data` rsync не трогает.

## Бэкап

`deploy/arca-backup.sh` делает ежедневный снимок базы и файлов и хранит его 7 дней. Неизменённые файлы связываются жёсткими ссылками, поэтому каждый день занимает только разницу.

Установка на сервере:

```bash
install -m 755 /opt/arca/deploy/arca-backup.sh /usr/local/bin/arca-backup
echo '30 3 * * * root /usr/local/bin/arca-backup' > /etc/cron.d/arca-backup
/usr/local/bin/arca-backup && ls /var/backups/arca      # проверить вручную
```

Снимки лежат в `/var/backups/arca` на том же сервере. Это защита от ошибок, но не от потери VPS. Всё содержимое зашифровано, поэтому копию можно спокойно забирать куда угодно:

```bash
rsync -a arca:/var/backups/arca/latest/ ~/backups/arca/
```

⚠️ Одноразовые заметки, дожившие до ночного бэкапа, остаются в снимках в виде шифротекста до 7 дней после прочтения. Без ключа из ссылки их не прочитать.

## Восстановление

```bash
systemctl stop arca
cp /var/backups/arca/<дата>/arca.db /opt/arca/data/arca.db
rsync -a --delete /var/backups/arca/<дата>/files/ /opt/arca/data/files/
chown -R arca:arca /opt/arca/data
systemctl start arca
```

## Логи и состояние

```bash
systemctl status arca
journalctl -u arca -n 50 --no-pager
du -sh /opt/arca/data
```

Просроченные заметки и файлы удаляются автоматически каждые 10 минут.
