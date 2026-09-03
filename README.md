# Instamate

A combination of multiple Instagram userscripts, built as a single Tampermonkey
script from small modules in `src/`.

## Structure

- `src/core/` — shared plumbing.
  - `settings.js` defines the `IM` object every other module uses:
    `IM.isEnabled('key')` / `IM.setEnabled('key', bool)`, plus the `IM_OPTS`
    and `IM_ADDONS` manifests that drive the settings popup.
  - `ui.js` injects a small gear button (bottom-right on any instagram.com
    page) that opens an Instagram-styled popup for switching opts on/off.
- `src/opts/` — **toggleable** features. Each one wraps its body in
  `if (IM.isEnabled('somekey')) { ... }` and has a matching entry in
  `IM_OPTS` (`src/core/settings.js`) so it shows up in the popup with a
  switch. Toggling takes effect after a reload, since opts run at
  `document-start`.
- `src/addons/` — **permanent** features. These always run once built in;
  they're listed in `IM_ADDONS` for visibility in the popup (shown with an
  "Always on" badge), but have no toggle.

Currently:

| Type   | Key              | What it does |
|--------|------------------|--------------|
| opt    | `anonstoryview`  | Blocks the `viewSeenAt` request so story views aren't recorded. |
| opt    | `reelsramsaver`  | Unloads off-screen Reels videos to save memory. |
| opt    | `msgname`        | Puts the DM contact/group name in the tab title. |
| addon  | `bulkphotosend`  | Multi-select photos in a DM and Instamate sends them one after another automatically, instead of you repeating attach → wait → send per photo. |

`pipinstavideocall` and `storyviewersearch` remain in `src/` but stay
commented out of `tools/build.c`'s `ORDER` list (WIP / not self-contained).

## Adding a new opt

1. `src/opts/yourfeature/script.js`, body wrapped in
   `if (IM.isEnabled('yourfeature')) { ... }`.
2. Add it to `ORDER` in `tools/build.c`, after `src/core/ui.js`.
3. Add `{ key: 'yourfeature', label: '...', description: '...' }` to
   `IM_OPTS` in `src/core/settings.js`.

## Adding a new addon

1. `src/addons/yourfeature/script.js`.
2. Add it to `ORDER` in `tools/build.c`.
3. Add it to `IM_ADDONS` in `src/core/settings.js` so it's listed in the
   popup (optional, but keeps the popup accurate).

## Building

```sh
make build   # compiles tools/build.c, writes dist/instamate.user.js
make watch   # rebuild on save (needs inotifywait)
make clean
```

Install `dist/instamate.user.js` in Tampermonkey (or any userscript
manager) and open instagram.com.
