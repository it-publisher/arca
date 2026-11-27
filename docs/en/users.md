# Users and access codes

Only people on the server’s list can write to Arca. Anyone with a link can read. There is no sign-up by design: this is a tool for you and a few trusted people, not a public service.

## Where users live

In `.env` on the server, comma-separated:

```ini
ARCA_USERS=me:<token>,anna:<token>,max:<token>
```

- Name — any word without `:` and `,`. It only helps you tell people apart
- Token — at least 24 characters, generated with `npm run -s token`

## Token vs access code

| | Token | Access code |
|---|---|---|
| Looks like | `Kx7…Qw` | `Kx7…Qw.hR7…Vb2` |
| Where | On the server and inside the code | Only with the person |
| Grants | Writing | Writing + decrypting “My notes” |

An access code is the token plus a random **history key**. That key never reaches the server.

## Common tasks

| Task | How |
|---|---|
| Add a person | `npm run -s token` → append `name:<token>` to `ARCA_USERS` → `systemctl restart arca` |
| Issue a code | The command below, once per person |
| Revoke access | Remove `name:<token>` from `ARCA_USERS` → `systemctl restart arca` |
| Code leaked | See below |

## Issue an access code

The command takes the token from the server, turns it into a code and puts it into the clipboard. The token never appears on screen or in shell history:

```bash
ssh arca "sed -nE 's/.*anna:([^,]+).*/\1/p' /opt/arca/.env" | npm run -s access-code | pbcopy
```

Hand the code over safely — for example, as a one-time note in Arca itself:

```bash
pbpaste | arca -t -b -e 1d | pbcopy
```

The person opens the link, copies the code and enters it on the sign-in page and in `arca login`.

## ⚠️ One code per person

Generate a code **once** and ask the person to keep it in a password manager. Every new code means a new history key:

- Notes created with the old code **won’t show up** in “My notes” (they are marked as “created with a different access code”)
- Links to them keep working and burn on schedule as usual

If someone loses their code, issue a new one: old links stay valid, they just won’t appear in the list.

## Code leaked

1. While the old code still works, delete sensitive notes with it: in “My notes” or `arca rm '<url>'`
2. Generate a new token and replace the old one in `ARCA_USERS`
3. `systemctl restart arca`
4. Issue the person a new code

The old code loses access to the server. Links that already reached the wrong hands keep opening until they expire — that’s why step 1 matters.
