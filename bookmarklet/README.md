# Install without Chrome Web Store or Developer mode

Two ways to run "Force Vertical" without publishing to the store and without turning on
Chrome's Developer mode.

> Reminder: the vertical layout only *renders* on Chrome. On Brave the layout switch
> fires but stays landscape (Brave blocks TikTok's WASM compositor). See the main README.

---

## Option A — Bookmarklet (nothing installed)

### A1 · One-button toggle (recommended)

`bookmarklet-toggle.txt` is a single ON/OFF button: first click turns it ON, next click
turns it OFF (shows a small "Force Vertical: ON/OFF" toast each time).

1. Open `bookmarklet-toggle.txt` and copy the whole line (starts with `javascript:`).
2. In Chrome, show the Bookmarks bar (`Ctrl+Shift+B`), right-click it → **Add page…**
3. Name: `TikTok Vertical`. URL: **paste** the copied line. Save.
4. On a TikTok live, click it once → ON (auto-vertical, follows you across lives). Click
   again → OFF (fully torn down, no reload needed).

### A2 · Separate ON / OFF buttons

If you prefer two buttons: use `bookmarklet.txt` (ON) and `bookmarklet-off.txt` (OFF) as
two separate bookmarks instead of the single toggle above.

Pros: zero install, no dev mode, no store. Con: one click per full page load.

### Turning it off

- **Quickest:** reload the page (`F5` / `Ctrl+R`). The bookmarklet lives only in the
  current page, so a reload removes it completely. Don't click it again to keep it off.
- **Without reloading:** add a second bookmark from `bookmarklet-off.txt` (name it
  `TikTok Vertical OFF`). Clicking it tears down the running bookmarklet (observer +
  history hooks) so it stops auto-switching. If it can't find a running instance it just
  reloads the page. It does not flip you back to horizontal — do that yourself from the
  gear menu if you want.
- Note: on the current live it already stops touching the player once vertical is applied,
  so you can manually switch to horizontal and it won't fight you (until you open a
  different live).

---

## Option B — Userscript (fully automatic)

Runs automatically on every TikTok live via a userscript manager. No Chrome dev mode, no
Web Store listing for *this* script — but the manager itself is installed once.

1. Install **Tampermonkey** or **Violentmonkey** (a userscript manager).
2. Open `tiktok-vertical.user.js` → the manager offers to install it → confirm.
3. Done. Every TikTok live now auto-switches to vertical.

Pros: fully automatic. Con: requires a userscript manager (installed once).

---

## Option C — Enterprise force-install (advanced, fully automatic, no dev mode/store)

For managed machines: use Chrome's `ExtensionInstallForcelist` / `ExtensionSettings`
policy pointing at a self-hosted `.crx` + update manifest. This installs the real
extension without Developer mode or the public store, but needs Windows registry/GPO edits
(admin) and a place to host the files. Overkill for a single user — prefer A or B.
