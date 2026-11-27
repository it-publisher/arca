# API

The HTTP API used by the browser and the CLI. All content that passes through it is ciphertext in base64url. Only the client encrypts and decrypts.

A ready-made client with all the cryptography is `shared/client.js`. It runs in both the browser and Node, so for your own scripts it’s easier to import it than to build requests by hand.

## Authorization

```text
Authorization: Bearer <token>
```

Send the **token**, not the access code: the history key never goes to the server.

## Endpoints

| Method | Path | Token | What it does |
|---|---|---|---|
| `GET` | `/api/me` | ✅ | Check the token → `{ user }` |
| `POST` | `/api/files` | ✅ | Upload an encrypted file (`application/octet-stream`) → `{ id }` |
| `POST` | `/api/notes` | ✅ | Create a note → `{ id }` |
| `GET` | `/api/notes` | ✅ | My live notes with encrypted history records |
| `GET` | `/api/notes/:id` | — | A note. For a one-time note, only the flag, no content |
| `POST` | `/api/notes/:id/open` | — | Open a one-time note and burn it |
| `PUT` | `/api/notes/:id` | ✅ | Edit your note (except one-time notes) |
| `DELETE` | `/api/notes/:id` | ✅ | Delete your note |
| `GET` | `/api/files/:id` | — | Download an encrypted file |

## Creating a note

```json
{
  "payload": "<base64url note ciphertext>",
  "ownerEntry": "<base64url record for “My notes”>",
  "files": ["<file id>"],
  "expiresIn": 2592000,
  "burnAfterRead": false
}
```

| Field | Meaning |
|---|---|
| `payload` | `iv (12 bytes) ‖ ciphertext ‖ tag (16 bytes)`, AES-256-GCM |
| `ownerEntry` | The note key and title, encrypted with the history key |
| `files` | Ids of files uploaded via `POST /api/files` |
| `expiresIn` | Seconds: `3600`, `86400`, `604800`, `2592000` or `null` (forever) |
| `burnAfterRead` | `true` — burn after reading |

## Node example

```javascript
import { publishNote } from './shared/client.js';

const { path } = await publishNote({
  baseUrl: 'https://arca.example.com',
  accessCode: process.env.ARCA_CODE,
  text: '# Report\n\nDone.',
  format: 'md',
});
console.log(`https://arca.example.com${path}`);
```

## Limits

| What | Limit |
|---|---|
| Note text | 1 MB |
| File | 50 MB |
| Files per note | 10 |

## Errors

| Code | When |
|---|---|
| `400` | Malformed request |
| `401` | Missing or wrong token |
| `404` | The note doesn’t exist, burned, expired or belongs to someone else |
| `411` | File upload without `Content-Length` |
| `413` | Size limit exceeded |
