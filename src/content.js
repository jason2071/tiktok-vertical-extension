/*
 * TikTok Live — Force Vertical Layout
 * -----------------------------------
 * TikTok LIVE dual-layout / landscape streams default to a HORIZONTAL player and
 * do NOT persist the viewer's orientation choice, so every new stream resets to
 * horizontal. This content script re-applies the "vertical layout" choice
 * automatically on every live page (including SPA navigations between lives).
 *
 * A toolbar popup toggle (chrome.storage.local key "enabled", default true) lets
 * the user turn the auto-switching on/off. When off, the script does nothing and
 * TikTok's own gear menu still works normally.
 *
 * Mechanism (verified against the live player DOM):
 *   1. The player control bar exposes a gear/settings button: [data-e2e="control-setting"].
 *   2. Clicking it opens a TUX menu whose rows are `.TUXMenuItem` with a
 *      `.TUXMenuItem-label` span.
 *   3. The orientation toggle label reads:
 *        - "Switch to vertical layout"   -> currently horizontal -> click to go vertical
 *        - "Switch to horizontal layout" -> already vertical      -> do nothing
 *   4. `.TUXMenuItem` has no `role`, so we match by class + localized label text.
 *
 * Stops cleanly (giveUp) when the stream has no orientation option (vertical-only
 * stream) so the MutationObserver does not re-trigger the retry loop forever.
 * Note: on Brave the WASM compositor is blocked so the switch has no visible effect;
 * use Chrome. (See README.)
 */
(() => {
  "use strict";

  const SEL = {
    gear: '[data-e2e="control-setting"], [data-e2e="player-settings"]',
    controlBar: '[data-e2e="control-bar-id-v2"]',
    menuItem: ".TUXMenuItem",
    menuItemLabel: ".TUXMenuItem-label",
  };
  const RE_TO_VERTICAL = /switch to vertical|vertical layout|แนวตั้ง/i;
  const RE_ALREADY_VERTICAL = /switch to horizontal|horizontal layout|แนวนอน/i;
  const RE_ORIENTATION = /orientation|วางแนว|แนวการแสดง/i; // the "Orientation" menu row header

  const LOG = "[VLtok]";
  const STORAGE_KEY = "enabled";
  const MENU_OPEN_DELAY = 450; // ms to let the settings menu render after opening
  const SLOW_ITEM_WAIT = 500; // extra wait when the Orientation row is present but the switch item isn't yet
  const RETRY_INTERVAL = 600; // ms between attempts while the player mounts
  const MAX_ATTEMPTS = 15; // hard cap on retries per stream (~15s)
  const GIVEUP_AFTER_MENU_READY = 5; // give up only if menu is ready AND has NO orientation row by this many tries
  const OBSERVER_DEBOUNCE = 300; // ms; live chat mutates constantly

  let enabled = true;
  let currentKey = null; // pathname identifying the current stream
  let done = false; // vertical confirmed for currentKey
  let giveUp = false; // no orientation option / attempts exhausted for currentKey
  let busy = false;
  let attempts = 0;
  let retryTimer = null;
  let observerDebounce = null;

  const isLivePage = () =>
    /\/live\b/.test(location.pathname) || !!document.querySelector(SEL.controlBar);

  const fireMouse = (el) => {
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      el.dispatchEvent(
        new MouseEvent(type, { bubbles: true, cancelable: true, view: window })
      );
    }
  };

  const findMenuItem = (re) => {
    for (const lbl of document.querySelectorAll(SEL.menuItemLabel)) {
      if (re.test((lbl.textContent || "").trim())) {
        return lbl.closest(SEL.menuItem) || lbl.parentElement;
      }
    }
    return null;
  };

  const closeMenu = (gear) => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
    if (findMenuItem(RE_TO_VERTICAL) || findMenuItem(RE_ALREADY_VERTICAL)) {
      if (gear) fireMouse(gear);
    }
  };

  let styleEl = null;
  const suppressMenuFlash = () => {
    if (styleEl) return;
    styleEl = document.createElement("style");
    styleEl.id = "vltok-flash-guard";
    styleEl.textContent = `
      [data-tux-portal] [role="menu"],
      [class*="TUXMenu"] { opacity: 0 !important; pointer-events: auto !important; }
    `;
    document.documentElement.appendChild(styleEl);
  };
  const restoreMenuFlash = () => {
    if (styleEl) {
      styleEl.remove();
      styleEl = null;
    }
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function forceVertical() {
    if (!enabled || done || giveUp || busy || !isLivePage()) return;
    busy = true;
    try {
      const gear = document.querySelector(SEL.gear);
      if (!gear) return; // player not mounted yet -> retry later

      suppressMenuFlash();
      fireMouse(gear); // open settings menu
      await sleep(MENU_OPEN_DELAY);

      let toVertical = findMenuItem(RE_TO_VERTICAL);
      let alreadyVertical = findMenuItem(RE_ALREADY_VERTICAL);

      // The "Switch to …" item can render a beat after the rest of the menu. If the
      // Orientation row is already there, wait a little longer and re-scan so we don't
      // miss a slow-loading switch item within this attempt.
      if (!toVertical && !alreadyVertical && findMenuItem(RE_ORIENTATION)) {
        await sleep(SLOW_ITEM_WAIT);
        toVertical = findMenuItem(RE_TO_VERTICAL);
        alreadyVertical = findMenuItem(RE_ALREADY_VERTICAL);
      }

      const menuOpen = document.querySelector(SEL.menuItemLabel) !== null;
      const hasOrientationRow =
        !!toVertical || !!alreadyVertical || !!findMenuItem(RE_ORIENTATION);

      if (toVertical) {
        fireMouse(toVertical);
        console.debug(LOG, "switched to vertical");
        done = true;
      } else if (alreadyVertical) {
        console.debug(LOG, "already vertical");
        done = true;
      } else if (menuOpen && !hasOrientationRow && attempts >= GIVEUP_AFTER_MENU_READY) {
        // Menu is fully open but has NO orientation row at all -> this stream has no
        // vertical option. Stop so the observer won't re-trigger forever.
        console.debug(LOG, "no orientation option; giving up");
        giveUp = true;
      }
      // else (orientation row present but switch not loaded yet, or menu not ready):
      // keep retrying up to MAX_ATTEMPTS.

      closeMenu(gear);
    } catch (err) {
      console.debug(LOG, "error", err);
    } finally {
      await sleep(50);
      restoreMenuFlash();
      busy = false;
    }
  }

  function startAttempts() {
    if (!enabled || done || giveUp) return;
    stopAttempts();
    attempts = 0;
    const tick = async () => {
      if (!enabled || done || giveUp) {
        stopAttempts();
        return;
      }
      if (attempts >= MAX_ATTEMPTS) {
        giveUp = true; // exhausted -> stop and don't let the observer restart us
        stopAttempts();
        return;
      }
      attempts++;
      await forceVertical();
      if (!done && !giveUp) retryTimer = setTimeout(tick, RETRY_INTERVAL);
      else stopAttempts();
    };
    tick();
  }
  function stopAttempts() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function onRouteMaybeChanged() {
    const key = location.pathname;
    if (key === currentKey) return;
    currentKey = key;
    done = false;
    giveUp = false; // fresh stream -> allow retries again
    if (enabled && isLivePage()) {
      startAttempts();
    } else {
      stopAttempts();
    }
  }

  // Debounced observer: live chat fires mutations constantly.
  const mo = new MutationObserver(() => {
    if (observerDebounce) return;
    observerDebounce = setTimeout(() => {
      observerDebounce = null;
      onRouteMaybeChanged();
      if (enabled && isLivePage() && !done && !giveUp && retryTimer === null) {
        startAttempts();
      }
    }, OBSERVER_DEBOUNCE);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // SPA navigation
  const emitRoute = () => window.dispatchEvent(new Event("vltok:route"));
  for (const m of ["pushState", "replaceState"]) {
    const orig = history[m];
    history[m] = function () {
      const ret = orig.apply(this, arguments);
      emitRoute();
      return ret;
    };
  }
  window.addEventListener("popstate", emitRoute);
  window.addEventListener("vltok:route", onRouteMaybeChanged);

  // Popup integration
  const applyEnabled = (val) => {
    enabled = val !== false;
    if (enabled) {
      currentKey = null; // force re-evaluation of the current live
      done = false;
      giveUp = false;
      onRouteMaybeChanged();
    } else {
      stopAttempts();
    }
  };

  try {
    chrome.storage?.local.get({ [STORAGE_KEY]: true }, (o) => applyEnabled(o[STORAGE_KEY]));
    chrome.storage?.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[STORAGE_KEY]) applyEnabled(changes[STORAGE_KEY].newValue);
    });
    chrome.runtime?.onMessage.addListener((msg, _s, sendResponse) => {
      if (msg && msg.type === "vltok:status") {
        sendResponse({ enabled, isLive: isLivePage(), applied: done, gaveUp: giveUp });
      }
      return true;
    });
  } catch (_e) {
    onRouteMaybeChanged();
  }
})();
