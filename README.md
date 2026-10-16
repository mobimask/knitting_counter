# Knitting Counter

An iPhone and iPad app for keeping your place while you knit.

- **Row counter**: tap the big counter to add a row. Undo removes one.
- **Stitch counter**: count stitches within a row, optionally reset at every new row.
- **Pattern repeats**: set how many rows a repeat has (and how many repeats), and the app shows
  "Repeat 3 of 12 · Row 5 of 8" with progress bars.
- **Multiple projects**: each project keeps its own counts and notes, saved on the device.
- Keeps the screen awake while counting and gives a light haptic tap on every count.

Requires iOS 17 or later.

## Running it on your iPhone

You need a Mac with Xcode 16 or later.

1. Clone this repository and open `KnittingCounter.xcodeproj`.
2. Select the **KnittingCounter** target → **Signing & Capabilities**, and pick your Apple ID team.
   A free Apple ID works for installing on your own phone.
3. Plug in your iPhone (or pick a simulator) and press **Run**.

## Project layout

```
KnittingCounter/
  KnittingCounterApp.swift   App entry point
  Model/                     KnittingProject, repeat math, save format (no UI code)
  Store/                     ProjectStore: holds projects and saves them to disk
  Views/                     Project list, counter screen, project editor
Tests/KnittingCoreTests/     Unit tests for the model
Package.swift                Builds Model/ as a package so the tests run with `swift test`
```

## Tests

```sh
swift test
```

## Web version (no Mac needed)

The same counter also runs as a web page, in two places:

- **Claude artifact** (private, for you): built straight from `web/index.html`. Projects are
  saved to your Claude account.
- **Public website** (for anyone): `docs/` is a standalone copy for GitHub Pages. Projects are
  saved in each person's own browser, with a **Save backup / Restore backup** option. It works
  offline, uses no outside services, and adds a proper icon when added to the Home Screen.

### Publishing the public website

1. On GitHub, open the repository → **Settings** → **General** → scroll to **Danger Zone** →
   **Change visibility** → **Public**.
2. Go to **Settings** → **Pages**. Under **Build and deployment**, set **Source** to
   **Deploy from a branch**, **Branch** to `main` and the folder to `/docs`, then **Save**.
3. After a minute or two the site is live at `https://mobaghodrat.github.io/knitting_counter/`.

On an iPhone: open that address in Safari, tap **Share → Add to Home Screen**.

### Changing the web app

Edit `web/index.html`, then rebuild the public copy:

```sh
python3 tools/build_site.py
```
