# How it works

Arca is built so that the server knows nothing about the contents of notes. Here is what happens when you publish, and why a server admin cannot read the text.

## Encrypting a note

1. The client (browser or CLI) generates a random **AES-256-GCM** key
2. The text and every file are encrypted on the client
3. Only encrypted bytes are sent to the server
4. The key goes into the link after `#`:

```text
https://arca.example.com/n/q3Zr8xKpL0a#hR7…Vb2
                           ^^^^^^^^^^^ ^^^^^^^
                           id          key
```

Browsers **never send** the part of a link after `#` (the fragment) to the server. The server receives a request for `/n/q3Zr8xKpL0a`, returns ciphertext, and the reader’s browser decrypts it with the key from the link.

So even with full access to the VPS and the database, notes cannot be read. The flip side matters too:

⚠️ Lose the link and you lose the note. Nobody can recover the key.

## Access code

An access code is one string per person: `<token>.<history key>`.

| Part | Stored | Purpose |
|---|---|---|
| Token | On the server (`ARCA_USERS`) and on the device | Right to create, edit and delete your notes |
| History key | **Only on the device** | Decrypting the “My notes” list |

Only the token is sent to the server. The history key stays with you.

## “My notes” on every device

When publishing, the client encrypts a tiny record with the history key: “note key + title”. It is stored on the server next to the note.

Any device with the same access code fetches these records and decrypts them locally. That is how the list is the same in your laptop browser, on your phone and in the CLI, while the server sees neither titles nor keys.

When a note burns, its record disappears with it.

## What the server sees

| Sees | Doesn’t see |
|---|---|
| Size of the note and files | Text, title, file names |
| Creation time and expiry | Note key |
| Which user created the note | History key |
| The “burn after reading” flag | Who opened the link (Caddy access log is off) |

## One-time notes

A note with “burn after reading” burns the moment someone clicks **«Открыть заметку»** (Open note), not when they follow the link:

1. The link opens a gate; the content is not loaded yet. Link previews in messengers and link scanners don’t burn the note: they don’t click buttons
2. The button sends a `POST`. In one transaction the server returns the ciphertext and wipes it from the database. If two people click at once, only one gets the text
3. The text stays in the reader’s tab until reload
4. Attachments remain available for 10 more minutes so they can be downloaded, then they are deleted

An unopened one-time note lives until its expiry.
