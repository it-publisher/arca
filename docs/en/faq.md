# FAQ

## Is there a public server to try it?

No. Arca is meant for your own server: an open anonymous instance with encryption can’t be moderated. You can try it locally in five minutes: [Quick start](/docs/quickstart/).

## How is Arca different from other pastebins?

Arca does one thing: quickly and privately share a note you need right now. Compared with typical pastebins:

- Client-side encryption, always, not as an option
- Only your people can write; anyone with a link can read
- One encrypted “My notes” list in the browser and the terminal
- A CLI for the terminal
- A Node server with zero external dependencies

## Can I enable open sign-up?

No, and that’s deliberate. Arca is a tool for you and a few trusted people. An open service with encryption quickly turns into hosting for phishing and malware, and encrypted content can’t be moderated.

## I lost a link to a note

If you have your access code, the note is in “My notes” in the browser or in `arca ls`. If not, it can’t be recovered: the key exists only in the link.

## I lost my access code

Ask the admin for a new one: `arca-user reset <name>`. Old links keep working, but they won’t appear in the new “My notes” list.

## Can the server admin read my notes?

No. They see only encrypted bytes, sizes, creation times and the author’s name. More: [Security](/docs/security/).

## When does a one-time note burn?

The moment someone clicks «Открыть заметку» (Open note), not when they follow the link. More: [How it works](/docs/how-it-works/#one-time-notes).

## Can I edit a note?

Yes, if you are the author: the ✏️ icon on the note page. The link stays the same. One-time notes can’t be edited.

## Why doesn’t it work over http://IP?

Browsers expose WebCrypto only in a secure context: over HTTPS or on `localhost`. Without it, encryption doesn’t work.

## How many resources does the server need?

Very few: the service uses about 30 MB of RAM. The cheapest VPS is enough. Disk usage depends on the files you upload.

## What language is the interface in?

Russian for now. The docs explain every control in English.

## Can an AI agent use it?

Yes, through the CLI: the agent runs `echo "<result>" | arca` and returns the link. For Node scripts there’s a ready-made client — see [API](/docs/api/).
