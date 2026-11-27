# Screenshots on macOS

Press a hotkey, select an area of the screen — a second later a link to the encrypted screenshot is in your clipboard. Esc cancels.

It works through `scripts/arca-shot.sh` and the CLI, so first run [`arca login`](/docs/cli/).

## Setup

1. Open Shortcuts → **+** → the **Run Shell Script** action
2. Paste the full path to `scripts/arca-shot.sh` as the script, for example:

   ```bash
   ~/code/arca/scripts/arca-shot.sh
   ```

3. Click **ⓘ** → **Add Keyboard Shortcut**, for example `⌃⌥⌘A`
4. Shortcuts settings → Advanced → turn on **Allow Running Scripts**
5. On first run macOS asks for **Screen Recording** permission — allow it

## What the script does

1. `screencapture -i` — interactive area selection
2. The screenshot is published with `arca` from a temporary folder that is removed afterwards
3. The link is copied to the clipboard and a notification appears

## Expiry

30 days by default. To change it, set a variable in the script action:

```bash
ARCA_SHOT_EXPIRES=1d ~/code/arca/scripts/arca-shot.sh
```

Allowed values: `1h`, `1d`, `1w`, `30d`, `never`.
