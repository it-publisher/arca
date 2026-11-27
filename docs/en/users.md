# Users and access codes

Only people on the server’s list can write to Arca. Anyone with a link can read. There is no sign-up by design: this is a tool for you and a few trusted people, not a public service.

Users are managed with the `arca-user` command on the server. It is installed during [deployment](/docs/deploy/) (step 6).

## Commands

| Command | What it does |
|---|---|
| `arca-user add <name>` | Create a user and print their access code |
| `arca-user reset <name>` | A new code instead of a leaked or lost one |
| `arca-user remove <name>` | Revoke access |
| `arca-user list` | List users |

Names may contain latin letters, digits, `-` and `_`. They only help you tell people apart.

## Add a person

From your computer:

```bash
ssh arca arca-user add anna | pbcopy
```

| Part | What it does |
|---|---|
| `ssh arca` | Runs the command on the server |
| `arca-user add anna` | Creates a token, appends `anna` to `/opt/arca/.env`, restarts Arca and prints the access code |
| `\| pbcopy` | Puts the code into your clipboard. It never appears on screen |

If Arca fails to start with the new list, the script restores the previous one.

Hand the code over safely — for example, as a one-time note in Arca itself:

```bash
pbpaste | arca -t -b -e 1d | pbcopy
```

The person opens the link, copies the code and enters it on the sign-in page and in `arca login`.

## Token vs access code

| | Token | Access code |
|---|---|---|
| Looks like | `Kx7…Qw` | `Kx7…Qw.hR7…Vb2` |
| Where | On the server, in `ARCA_USERS` | Only with the person |
| Grants | Writing | Writing + decrypting “My notes” |

An access code is the token plus a random **history key**. The key is created once, when the code is issued, and is never stored on the server.

## ⚠️ A code is issued once

Ask the person to save the code in a password manager right away. It can’t be recovered: the history key exists nowhere but in the code.

If a code is lost, issue a new one:

```bash
ssh arca arca-user reset anna | pbcopy
```

- Links to old notes keep working and burn on schedule as usual
- They **won’t appear** in “My notes”: a new code means a new history key

## Code leaked

1. While the old code still works, delete sensitive notes with it: in “My notes” or `arca rm '<url>'`
2. Issue a new code: `ssh arca arca-user reset anna | pbcopy`. The old one stops working immediately
3. Hand the new code to the person

Links that already reached the wrong hands keep opening until they expire — that’s why step 1 matters.

## Revoke access

```bash
ssh arca arca-user remove anna
```

The person can no longer create notes. Links they already sent keep working until they expire.
