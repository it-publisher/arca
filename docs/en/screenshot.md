# Screenshots on macOS

Press a hotkey, select an area of the screen — a second later a link to the encrypted screenshot is in your clipboard. Esc cancels.

## Preparation

From the project folder:

```bash
npm run cli:install      # installs the arca and arca-shot commands
arca login               # if you haven't signed in yet
which arca-shot          # note the path, you'll need it below
```

On Apple Silicon Macs the path is `/opt/homebrew/bin/arca-shot`, on Intel — `/usr/local/bin/arca-shot`.

## Hotkey setup

1. Open Shortcuts → **+** → the **Run Shell Script** action
2. Paste the full path from `which arca-shot` as the script, e.g. `/opt/homebrew/bin/arca-shot`
3. ⚠️ **Run as Administrator** must be **off**
4. Click **ⓘ** → **Add Keyboard Shortcut**, for example `⌃⌥⌘A`
5. Shortcuts settings → Advanced → turn on **Allow Running Scripts**
6. On first run macOS asks for **Screen Recording** permission — allow it

Leave the other fields of the action (shell, input) as they are.

## What the script does

1. `screencapture -i` — interactive area selection
2. The screenshot is published with `arca` from a temporary folder that is removed afterwards
3. The link is copied to the clipboard and a notification appears

## Expiry

30 days by default. To change it, put a variable before the path in the script text:

```bash
ARCA_SHOT_EXPIRES=1d /opt/homebrew/bin/arca-shot
```

Allowed values: `1h`, `1d`, `1w`, `30d`, `never`.

## Troubleshooting

| You see | Cause | Fix |
|---|---|---|
| `Operation not permitted` | The path points into the project on the Desktop, in Documents or Downloads. macOS doesn’t let Shortcuts in there | Run `npm run cli:install` and use the path from `which arca-shot` |
| `command not found` | Shortcuts uses its own short `PATH` | Use the full path, not just `arca-shot` |
| A “Не удалось загрузить” (upload failed) notification | Run as Administrator is on, or `arca login` wasn’t done | Turn the checkbox off, run `arca login` |
| The screenshot is empty or shows only the wallpaper | No Screen Recording permission | System Settings → Privacy & Security → Screen Recording → enable Shortcuts |
