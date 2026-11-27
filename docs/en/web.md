# Web interface

The interface is in Russian for now; English names are given in parentheses.

## Pages

| Address | What’s there |
|---|---|
| `/` | Editor: text, files, expiry, “My notes” |
| `/n/<id>#<key>` | Note view. No sign-in needed |
| `/login` | Sign in with an access code |

![Arca editor](/assets/screens/editor-light.webp)

## Formats

Pick the format at the top right of the editor.

| Format | For | Shown as |
|---|---|---|
| **Markdown** | Texts, plans, task lists | Like on GitHub: headings, tables, checkboxes, highlighted code blocks |
| **Код** (Code) | Scripts, configs, logs, markup | Syntax highlighting, line numbers, wide page |
| **Обычный текст** (Plain text) | Everything else | As is, monospaced |

For code, the language is detected automatically or picked from the list: Bash, Python, JavaScript, TypeScript, JSON, HTML/XML, CSS, SQL, YAML, Diff, Go, Rust, Java, PHP, C, C++, Dockerfile, Nginx, INI/TOML and more.

💡 Code is only **displayed**: HTML is not rendered, scripts never run. It’s safe to share markup or a suspicious snippet from an investigation.

The **«Предпросмотр»** (Preview) tab shows the note the way the reader will see it.

## Files

- Up to 10 files of 50 MB each
- Drag onto the page, paste from the clipboard (`⌘V`) or pick in a dialog
- Files are encrypted just like text. Readers download them with a button; the browser doesn’t open or run anything

If the clipboard holds both text and a file, the text is pasted.

## Expiry

| Option | Deleted |
|---|---|
| 1 hour, 1 day, 1 week | After that time |
| **30 days** | Default |
| Forever | Only manually |

The note and the list show a countdown: “🔥 12 days”.

## Burn after reading

Turn on the 🔥 toggle before publishing. The note can be opened **once**, with the «Открыть заметку» (Open note) button. Details: [How it works](/docs/how-it-works/#one-time-notes).

![One-time note](/assets/screens/burn-light.webp)

## Draft

Text is saved in the browser as you type. Close the tab — the draft is there next time. Publishing clears it.

## Note page

![Note view](/assets/screens/note-light.webp)

Icons at the top right:

| Icon | Action |
|---|---|
| ✏️ | Edit. Visible only to the author; the link stays the same. One-time notes can’t be edited |
| Share | System share sheet on phones, copies the link on desktop |
| Copy | Note text to the clipboard |
| Download | Text to a file: `.md`, `.txt` or the code language’s extension |

## My notes

The list of live notes on the right. It is shared by every browser and the CLI with the same access code. You can delete a note from here without waiting for expiry.

## Shortcuts

| Keys | Action |
|---|---|
| `⌘↵` / `Ctrl+Enter` | Create a link and copy it |
| `⌘V` | Paste a file or screenshot from the clipboard |

## Theme

Light and dark, following the system setting.
