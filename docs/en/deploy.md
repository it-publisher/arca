# Deploy to a VPS

Let’s put Arca on your own server with HTTPS. The frontend is built on your computer; the server needs only Node and Caddy. The example uses Ubuntu 24.04.

## What you need

| What | Minimum |
|---|---|
| VPS | 1 vCPU, 512 MB RAM. The service itself uses about 30 MB |
| Domain | Any subdomain, e.g. `arca.example.com` |
| Access | SSH with a key as `root` or a user with `sudo` |
| Locally | Node 22.13+ and a clone of the repository (see [Quick start](/docs/quickstart/)) |

⚠️ HTTPS is required: browsers don’t expose WebCrypto on plain `http://IP`, and encryption won’t work.

Add a host to `~/.ssh/config` and every command below works as is:

```text
Host arca
  HostName 203.0.113.10
  User root
  IdentityFile ~/.ssh/arca
```

## 1. DNS

Create an A record for the subdomain pointing at the server IP:

```text
arca.example.com.  A  203.0.113.10
```

- On Cloudflare use “DNS only”, without proxying
- If the domain has CAA records, they must include `letsencrypt.org`

Check: `dig +short arca.example.com` returns the server IP.

## 2. Secure the server

On the server:

```bash
# Key-only SSH. The 00- prefix overrides 50-cloud-init.conf
printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin prohibit-password\n' \
  > /etc/ssh/sshd_config.d/00-hardening.conf
sshd -t && systemctl reload ssh

# Firewall: SSH and web only
ufw default deny incoming
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443
ufw --force enable
```

⚠️ Before closing the current session, check key login in a **new** terminal window.

## 3. Install Node and Caddy

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

## 4. User and folders

```bash
useradd --system --home-dir /opt/arca --no-create-home --shell /usr/sbin/nologin arca
install -d -o root -g root -m 0755 /opt/arca
install -d -o arca -g arca -m 0700 /opt/arca/data
```

The code belongs to `root`; the service runs as `arca` and can write only to `data`.

## 5. Upload the code

On your computer, from the project folder:

```bash
npm run build
rsync -a --delete --chown=root:root \
  --include='/package.json' --include='/server/***' --include='/shared/***' \
  --include='/dist/***' --include='/deploy/***' --exclude='*' ./ arca:/opt/arca/
```

## 6. Configure and start

Generate a token per user (locally, `npm run -s token`). Then on the server:

```bash
cat > /opt/arca/.env <<'ENV'
ARCA_USERS=me:<token>,friend:<token>
ARCA_HOST=127.0.0.1
ARCA_PORT=3000
ARCA_DATA_DIR=/opt/arca/data
ENV
chown root:arca /opt/arca/.env && chmod 640 /opt/arca/.env

cp /opt/arca/deploy/arca.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now arca
```

## 7. HTTPS with Caddy

```bash
cp /opt/arca/deploy/Caddyfile /etc/caddy/Caddyfile
sed -i 's/arca.example.com/your.domain/' /etc/caddy/Caddyfile
systemctl reload caddy
```

Caddy gets a Let’s Encrypt certificate by itself within seconds.

## 8. Check

```bash
systemctl status arca --no-pager          # active (running)
curl -sI https://your.domain | head -1    # HTTP/2 200
```

Open the address in a browser and sign in with an access code. How to get one: [Users and access codes](/docs/users/).

## Next

- [Updates and backups](/docs/maintenance/): daily snapshots and shipping new versions
- [CLI](/docs/cli/): `arca login` with your server URL
