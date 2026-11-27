# Quick start

Let’s run Arca on your computer, create the first note and open it by link. It takes about five minutes. To share notes with other people you will need a server later: see [Deploy to a VPS](/docs/deploy/).

## Requirements

- Node.js **22.13 or newer**: it ships the built-in `node:sqlite`, no other database needed
- Git
- Any modern browser

Check your Node version:

```bash
node -v
```

## 1. Download and build

```bash
git clone https://github.com/it-publisher/arca.git
cd arca
npm install
npm run build
```

`npm install` only installs the frontend build tools. The server itself needs no external packages.

## 2. Create a user

Only users listed in `ARCA_USERS` can write to Arca. Generate a token and put it into `.env`:

```bash
npm run -s token                 # prints a random token
cp .env.example .env
```

Open `.env` and replace `REPLACE_WITH_TOKEN` with the token:

```ini
ARCA_USERS=me:Kx7…your-token…Qw
```

## 3. Start

```bash
npm start
```

The server listens on `http://127.0.0.1:3000`.

## 4. Get an access code and sign in

The token is the right to write to the server. To sign in you need an **access code**: the token plus the key that encrypts your list of notes. In a new terminal window:

```bash
echo "<token>" | npm run -s access-code
```

Open `http://127.0.0.1:3000` and paste the code into the “Код доступа” (access code) field. The browser remembers it.

⚠️ Keep the code in a password manager. You need it on every new device, and it cannot be recovered: the history key exists only inside the code. More: [Users and access codes](/docs/users/).

## 5. First note

1. Type something, for example `# Hello, Arca`
2. Click **«Создать ссылку»** (Create link) or press `⌘↵`
3. The link is already in your clipboard: open it in another browser or a private window

The note is decrypted right in the browser. The server stores only ciphertext.

💡 The interface is in Russian for now. The [Web interface](/docs/web/) page explains every control.

## Next steps

- [Web interface](/docs/web/): formats, files, expiry, one-time notes
- [CLI](/docs/cli/): publish from the terminal and your editor
- [Deploy to a VPS](/docs/deploy/): so links open for your colleagues
