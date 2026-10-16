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

`web/index.html` is the same counter as a single web page, published as a private Claude
artifact. Open it in Safari on your iPhone (signed in to claude.ai) and tap
**Share → Add to Home Screen** for a one-tap shortcut. Projects are saved to your Claude
account, so they show up on any device where you open the page.
