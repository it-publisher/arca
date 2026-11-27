# CLI

`arca` is the same Arca in your terminal: it publishes files, command output and drafts from `$EDITOR`. It encrypts exactly like the browser and sees the same “My notes” list.

## Install

From the project folder:

```bash
npm link                 # makes the arca command available globally
arca login               # server URL + access code
```

`arca login` saves settings to `~/.config/arca/config.json` with mode `600`.

## Commands

| Command | What it does |
|---|---|
| `arca` | Open `$EDITOR`; after save and quit — a link |
| `arca note.md` | Publish a file |
| `echo "text" \| arca` | Publish stdin |
| `arca get '<url>'` | Decrypt a note to stdout |
| `arca get '<url>' -o dir` | …and save attachments to a folder |
| `arca ls` | My notes: link, expiry, title (tab-separated) |
| `arca rm '<url>'` | Delete a note |

⚠️ Put links in **single quotes**: zsh treats `#` as a special character.

## Flags

| Flag | Meaning |
|---|---|
| `-a, --attach <file>` | Attach a file, repeatable |
| `-e, --expires <ttl>` | `1h`, `1d`, `1w`, `30d` (default), `never` |
| `-b, --burn` | Burn after reading |
| `-t, --text` | Plain text instead of Markdown |
| `-l, --lang <id>` | Highlighted code: `auto`, `bash`, `python`, `javascript`, `json`, `xml`, `sql`, `diff`… |

Full list of languages: `arca -h`.

## How the format is chosen

| Source | Format |
|---|---|
| `-t` flag | Plain text |
| `-l <language>` flag | Code in that language |
| `.md` or stdin | Markdown |
| `.py`, `.sh`, `.html`, `.json`, `.diff`, `.log` and other known extensions | Code, language from the extension |
| Other files | Plain text |

## Editor mode

`arca` with no arguments opens `$EDITOR`. Save and quit — the note is published and the link goes to stdout.

The draft lives in `~/.local/state/arca/draft.md` (mode `600`) until it is published. Closed the terminal mid-way — run `arca` again and the text is still there. If the editor exits with an error (say, `:cq` in vim), the draft is kept but not published.

```bash
export EDITOR=nvim             # or "zed --wait"
```

## Examples

```bash
arca | pbcopy                                   # link straight to the clipboard
arca draft.md -e 1w                             # a file for a week
git diff | arca -l diff -e 1d                   # a diff for a day
journalctl -u app -n 200 | arca -l plaintext    # a log with line numbers
arca report.md -a data.csv -a chart.png         # a note with attachments
echo "staging password" | arca -t -b            # a one-time note
arca get '<url>' > note.md                      # a note into a file, e.g. for Obsidian
```

## nvim

```vim
:w !arca                       " publish the current buffer
:r !arca get '<url>'           " insert a note below the cursor
```

## Environment variables

| Variable | Meaning |
|---|---|
| `ARCA_URL` | Server URL, overrides the config |
| `ARCA_CODE` | Access code, overrides the config |
| `EDITOR` | Editor for editor mode |

Variables are handy for scripts and AI agents: the agent publishes its result with `arca` and returns the link.
