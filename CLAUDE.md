# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A tiny, dependency-free tool that auto-switches TikTok **LIVE** dual-layout/landscape
streams to **vertical layout** on every live (TikTok resets to horizontal on each new
stream and does not persist the choice). It re-applies across SPA navigations between
lives without a page reload.

There is **no build system, no package manager, no tests, and no lint config** — every
file is hand-written static JS/HTML/JSON shipped as-is. "Running" means loading the
extension or pasting a bookmarklet (see below); there are no commands to build or test.

## The one rule that matters: three copies of one algorithm

The exact same core logic exists in **three delivery formats**, and a change to the
matching logic must be propagated to all of them or they drift out of sync:

| File | Format | Extra concerns |
|------|--------|----------------|
| `src/content.js` | MV3 extension content script | popup on/off toggle via `chrome.storage.local` key `"enabled"`; `vltok:status` message handler for the popup |
| `bookmarklet/tiktok-vertical.user.js` | Tampermonkey/Violentmonkey userscript | `window.__vltok` single-run guard; `@match` header |
| `bookmarklet/bookmarklet-toggle.txt` (+ `bookmarklet.txt` ON, `bookmarklet-off.txt` OFF) | minified `javascript:` one-liner | ON/OFF toast; `window.__vltokStop` teardown that unhooks the observer + history patches |

The **selectors and label regexes are the fragile part** and are duplicated in each
file. When TikTok markup changes and auto-switching breaks, update these in **every**
copy:

- Gear button: `[data-e2e="control-setting"], [data-e2e="player-settings"]`
- Live detection: `[data-e2e="control-bar-id-v2"]` (or `/\/live\b/` in the path)
- Menu row / label: `.TUXMenuItem` / `.TUXMenuItem-label` (rows have no `role`, so we
  match by class + localized text)
- Label matchers (English + Thai): `RE_TO_VERTICAL` / `RE_ALREADY_VERTICAL` /
  `RE_ORIENTATION` in `content.js`; `RV` / `RH` / `RO` in the bookmarklet/userscript

`src/content.js` is the canonical, readable source; the `.user.js` and `.txt` files are
hand-derived from it. Edit `content.js` first, then port.

## Core algorithm (shared by all three)

A retry loop driven by a `MutationObserver` (TikTok's live chat mutates constantly, so
the observer is debounced ~300ms):

1. `forceVertical()` opens the gear menu, waits ~450ms for the TUX menu to render, and
   scans menu labels. If the "Orientation" row is present but the switch item hasn't
   rendered, it waits ~500ms more and re-scans within the same attempt.
2. Found "Switch to vertical" → click it → `done`. Found "Switch to horizontal"
   (already vertical) → `done`, no click. Menu fully open with **no** orientation row
   after several tries → `giveUp` (vertical-only stream; stops the observer from
   retrying forever).
3. The menu is hidden with an injected `opacity:0` style during the toggle so it
   doesn't visibly flash.

Per-stream state flags: `done`, `giveUp`, `busy`, and (in the userscript) `running`.
`onRouteMaybeChanged()` / `route()` resets `done`/`giveUp` when `location.pathname`
changes so each new live gets a fresh set of attempts. History `pushState`/
`replaceState` are monkey-patched to emit a route event for SPA navigation.

**Re-entrancy caveat:** the observer must not launch a second concurrent retry loop
while one is already running, or the menu opens/closes repeatedly ("bouncing"). The
userscript guards this with a dedicated `running` flag (do not gate on
`timer === null` — the timer is null during the `await`, so that check spuriously
passes and spawns a parallel loop). `src/content.js` and the `.txt` bookmarklets still
gate on `retryTimer === null` / `timer === null` and are susceptible to the same bug;
port the `running` guard if touching them.

## Manual testing

- **Extension:** `chrome://extensions` → enable Developer mode → Load unpacked → select
  the repo folder. Open `https://www.tiktok.com/@<user>/live`; a landscape/dual-layout
  live should flip vertical within ~1–2s. Reload the live tab after any code change.
- **Userscript:** open `bookmarklet/tiktok-vertical.user.js` with Tampermonkey/
  Violentmonkey installed; bump `@version` so the manager offers the update.
- **Bookmarklet:** paste the `.txt` one-liner as a bookmark URL; click on a live.

Debug logging is under the `[VLtok]` prefix (`console.debug`).

## Known platform limitation (not a bug to fix)

On **Brave**, the switch fires but the layout does **not** visibly change: TikTok's
vertical layout is composited by a WebAssembly module that Brave's fingerprinting/media
protections break (`.wasm` request returns HTML → `WebAssembly.instantiate()` throws).
A content script cannot override this. **Use Chrome.** Full diagnosis is in `README.md`.
