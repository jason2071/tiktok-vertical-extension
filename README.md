# TikTok Live — Force Vertical Layout

Chrome extension (Manifest V3) that automatically switches TikTok **LIVE** streams to
**vertical layout** every time you open a live.

## Why

TikTok LIVE dual-layout / landscape streams default to a **horizontal** player, and the
site does **not** remember your orientation choice — every new stream resets to
horizontal. This extension re-applies "vertical layout" for you on every live, including
when you navigate between lives without a page reload.

## Install (Load unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select this folder (`vertical-layout-tiktok`).
4. Open any live, e.g. `https://www.tiktok.com/@<user>/live`.
   - A landscape/dual-layout live switches to vertical within ~1–2 seconds.

Works in Chrome and other Chromium browsers (Edge, Brave) via the same *Load unpacked* flow.

## How it works

- Runs a content script on `www.tiktok.com`.
- On each live page it opens the player's gear (⚙) settings menu, finds the
  **Orientation → "Switch to vertical layout"** item, and clicks it. If the stream is
  already vertical (or is vertical-only), it does nothing.
- Re-applies automatically on SPA navigation between lives (history API + `MutationObserver`).
- The settings menu is hidden during the toggle so you don't see it flash open.

## Toolbar toggle

Click the extension's toolbar icon for a small popup with an **Auto vertical layout**
on/off switch:

- **On** (default): forces vertical on every live.
- **Off**: does nothing — TikTok's own gear menu still works normally.

The choice is saved (`chrome.storage.local`) and applies immediately: flipping it on
while watching a live applies vertical right away; flipping it off stops auto-switching.
The popup also shows live status ("Active — vertical layout applied ✓").

## Files

```
manifest.json      MV3 manifest (content script + toolbar popup, "storage" permission)
src/content.js     All logic; selectors centralized in the SEL object at the top
src/popup.html     Toolbar popup UI (on/off switch + status)
src/popup.js       Popup logic (reads/writes chrome.storage, queries live status)
icons/             Toolbar icons
```

## Maintenance

TikTok markup can change. If auto-switching stops working, update the selectors /
label matchers at the top of `src/content.js`:

- `SEL.gear` — the player settings (gear) button (`[data-e2e="control-setting"]`).
- `SEL.menuItem` / `SEL.menuItemLabel` — TUX menu row + label.
- `RE_TO_VERTICAL` / `RE_ALREADY_VERTICAL` — localized label text (English + Thai included).

## Browser compatibility

Use **Chrome** (or plain Chromium). On **Brave**, the extension still performs the
switch correctly (the setting flips), but the layout does **not visibly change**.

**Root cause (diagnosed on Brave):** TikTok's vertical layout is rendered by a
**WebAssembly** compositor (it stacks the streamer's webcam on top of the gameplay).
On Brave the `.wasm` binary fails to load — the request comes back as an HTML page
instead of the binary, so `WebAssembly.instantiate()` throws:

```
CompileError: WebAssembly.instantiate(): expected magic word 00 61 73 6d, found 3c 21 44 4f
                                          (\0asm = wasm)          (<!DO = <!DOCTYPE html>)
→ "bg color comupted error" → Uncaught RuntimeError  (fires exactly when you toggle)
```

With the compositor dead, clicking "Switch to vertical layout" has no effect — the
player keeps showing the raw 1920×1080 landscape feed letterboxed, so vertical and
horizontal look identical. This is **Brave breaking the WASM compositor**, not an
extension bug (a content script cannot override Brave's privacy/network layer).

**What was tried on Brave (and the result):** Turning off **Block fingerprinting**
(`brave://settings/shields`) *does* clear the WASM `CompileError` — the compositor then
loads (only a benign emscripten warning remains). But even with **fingerprinting off,
third-party cookies allowed, scripts allowed, and Shields down**, the vertical composite
still does **not** render — the player stays on the landscape feed. Some deeper Brave
protection (canvas/WebGL farbling or the media pipeline) still blocks it.

**Conclusion: use Chrome.** On Chrome everything works out of the box. Brave is not
reliably fixable from the extension or from Shields settings.

## Notes

- No account login, no network requests, no data collection, no stored settings.
- Only touches pages under `www.tiktok.com`.
