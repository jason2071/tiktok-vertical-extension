// ==UserScript==
// @name         TikTok Live — Force Vertical Layout
// @namespace    vltok
// @version      1.1.1
// @description  Auto-switch TikTok LIVE dual-layout streams to vertical. No Chrome dev mode / store needed — runs under Tampermonkey/Violentmonkey.
// @match        *://www.tiktok.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function () {
  "use strict";
  if (window.__vltok) return;
  window.__vltok = 1;

  const RV = /switch to vertical|vertical layout|แนวตั้ง/i;
  const RH = /switch to horizontal|horizontal layout|แนวนอน/i;
  const RO = /orientation|วางแนว|แนวการแสดง/i; // "Orientation" menu row header
  const MAX = 15, GIVEUP_READY = 5, DEBOUNCE = 300, DELAY = 450, SLOW = 500;
  let done = false, giveUp = false, busy = false, running = false, timer = null, key = null, n = 0, deb = null, st = null;

  const live = () =>
    /\/live\b/.test(location.pathname) ||
    !!document.querySelector('[data-e2e="control-bar-id-v2"]');
  const fire = (e) =>
    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((t) =>
      e.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }))
    );
  const item = (re) => {
    for (const l of document.querySelectorAll(".TUXMenuItem-label"))
      if (re.test((l.textContent || "").trim()))
        return l.closest(".TUXMenuItem") || l.parentElement;
    return null;
  };
  const sleep = (m) => new Promise((r) => setTimeout(r, m));
  const hide = () => {
    if (st) return;
    st = document.createElement("style");
    st.textContent = '[data-tux-portal] [role="menu"],[class*="TUXMenu"]{opacity:0!important}';
    document.documentElement.appendChild(st);
  };
  const show = () => { if (st) { st.remove(); st = null; } };

  async function force() {
    if (done || giveUp || busy || !live()) return;
    busy = true;
    try {
      const g = document.querySelector('[data-e2e="control-setting"],[data-e2e="player-settings"]');
      if (!g) return;
      hide();
      fire(g);
      await sleep(DELAY);
      let v = item(RV), a = item(RH);
      // switch item can render a beat late; if the Orientation row is present, wait + re-scan
      if (!v && !a && item(RO)) { await sleep(SLOW); v = item(RV); a = item(RH); }
      const open = document.querySelector(".TUXMenuItem-label") !== null;
      const hasOri = !!v || !!a || !!item(RO);
      if (v) { fire(v); done = true; }
      else if (a) done = true;
      else if (open && !hasOri && n >= GIVEUP_READY) giveUp = true; // no orientation option at all -> stop
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    } catch (e) {} finally {
      await sleep(50);
      show();
      busy = false;
    }
  }
  function start() {
    if (done || giveUp || running) return; // running guard: no parallel loops
    stop();
    running = true;
    n = 0;
    (function tick() {
      if (done || giveUp) { stop(); return; }
      if (n >= MAX) { giveUp = true; stop(); return; }
      n++;
      force().then(() => {
        if (!done && !giveUp && running) timer = setTimeout(tick, 600);
        else stop();
      });
    })();
  }
  function stop() { running = false; if (timer) { clearTimeout(timer); timer = null; } }
  function route() {
    const k = location.pathname;
    if (k === key) return;
    key = k;
    done = false;
    giveUp = false;
    stop(); // clear old loop before restart
    if (live()) start();
  }

  new MutationObserver(() => {
    if (deb) return;
    deb = setTimeout(() => {
      deb = null;
      route();
      if (live() && !done && !giveUp && !running) start();
    }, DEBOUNCE);
  }).observe(document.documentElement, { childList: true, subtree: true });

  for (const m of ["pushState", "replaceState"]) {
    const o = history[m];
    history[m] = function () {
      const r = o.apply(this, arguments);
      window.dispatchEvent(new Event("vltok:r"));
      return r;
    };
  }
  addEventListener("popstate", () => window.dispatchEvent(new Event("vltok:r")));
  addEventListener("vltok:r", route);
  route();
})();
