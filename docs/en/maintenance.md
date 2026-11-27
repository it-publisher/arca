# Updates and backups

## Updating

On your computer, from the project folder:

```bash
git pull
npm install
npm test && npm run build
ssh arca /usr/local/bin/arca-backup        # snapshot before shipping
rsync -a --delete --chown=root:root \
  --include='/package.json' --include='/server/***' --include='/shared/***' \
  --include='/dist/***' --include='/deploy/***' --exclude='*' ./ arca:/opt/arca/
ssh arca systemctl restart arca
```

Database migrations run automatically on start. rsync doesn’t touch the data in `/opt/arca/data`.

## Backups

`deploy/arca-backup.sh` takes a daily snapshot of the database and files and keeps it for 7 days. Unchanged files are hard-linked, so each day costs only the difference.

Install on the server:

```bash
install -m 755 /opt/arca/deploy/arca-backup.sh /usr/local/bin/arca-backup
echo '30 3 * * * root /usr/local/bin/arca-backup' > /etc/cron.d/arca-backup
/usr/local/bin/arca-backup && ls /var/backups/arca      # run once by hand
```

Snapshots live in `/var/backups/arca` on the same server. That protects against mistakes, not against losing the VPS. Everything is encrypted, so it’s safe to copy the backup anywhere:

```bash
rsync -a arca:/var/backups/arca/latest/ ~/backups/arca/
```

⚠️ One-time notes that lived past the nightly backup stay in snapshots as ciphertext for up to 7 days after being read. Without the key from the link they can’t be read.

## Restoring

```bash
systemctl stop arca
cp /var/backups/arca/<date>/arca.db /opt/arca/data/arca.db
rsync -a --delete /var/backups/arca/<date>/files/ /opt/arca/data/files/
chown -R arca:arca /opt/arca/data
systemctl start arca
```

## Logs and status

```bash
systemctl status arca
journalctl -u arca -n 50 --no-pager
du -sh /opt/arca/data
```

Expired notes and files are removed automatically every 10 minutes.
