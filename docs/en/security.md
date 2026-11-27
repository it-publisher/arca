# Security

## Threat model

| Threat | Protection |
|---|---|
| Server breach or database leak | All content is encrypted on the client; there are no keys on the server |
| VPS admin or hosting provider | Same: only sizes, times and the author’s name are visible |
| Traffic interception | HTTPS, HSTS |
| Link previews in messengers | The key in the `#` fragment never reaches the server. One-time notes open only with a button |
| Malicious content in a note | Code never runs, Markdown is sanitized, strict CSP |
| Token guessing | 256-bit tokens, constant-time comparison |

## What Arca doesn’t protect against

- **A leaked link.** The link is the key. Whoever has it can read the note until it expires
- **A compromised device** of the author or reader
- **A tampered server.** An attacker who controls the server can serve modified JavaScript. This is a shared problem of every web service with in-browser encryption. The CLI is immune to it: its code runs locally
- **Metadata.** The server knows how many notes each user created, their sizes and times

## How it’s protected

### Encryption

- AES-256-GCM via WebCrypto, built into browsers and Node
- A random key per note and a fresh IV for every text and file
- GCM checks integrity: tampered ciphertext won’t decrypt

### Server

- Only users in `ARCA_USERS` can create notes
- Someone else’s note can’t be edited or deleted: the server answers `404`, same as for a missing note
- A one-time note is served only via `POST` and wiped in the same transaction
- Files are served as `application/octet-stream`: SVG and HTML won’t run in the browser

### Browser

- Markdown goes through DOMPurify; `<style>` and `<form>` are forbidden
- Strict CSP: own scripts only, no inline code or `eval`
- External images in Markdown are blocked by CSP, so readers don’t leak their IP to third-party sites
- `Referrer-Policy: no-referrer`, `noindex`, no framing

### Infrastructure

- The systemd service is sandboxed: it writes only to `/opt/arca/data`, with no access to `/home`, devices or the kernel
- The code belongs to `root`; the service can’t modify it
- Caddy keeps no access log: reader IPs are stored nowhere
- No external npm dependencies on the server: a smaller supply-chain attack surface

## Tips

- Keep your access code in a password manager
- On a shared computer, click «Выйти» (Sign out) when done: the code and draft live in `localStorage`
- For passwords and secrets, turn on “burn after reading” and a short expiry
- Send the link and its context through different channels when it matters

## Found a vulnerability?

Report it via [GitHub Security Advisories](https://github.com/it-publisher/arca/security/advisories/new), not in public issues.
