"use strict";

const STORAGE_KEY = "enabled";
const toggle = document.getElementById("toggle");
const statusEl = document.getElementById("status");

const TIKTOK_RE = /:\/\/www\.tiktok\.com\//;

function setStatus(text, ok) {
  statusEl.textContent = text;
  statusEl.classList.toggle("ok", !!ok);
}

// Reflect current enabled state, then show live status.
chrome.storage.local.get({ [STORAGE_KEY]: true }, (o) => {
  toggle.checked = o[STORAGE_KEY] !== false;
  refreshStatus();
});

toggle.addEventListener("change", () => {
  chrome.storage.local.set({ [STORAGE_KEY]: toggle.checked }, refreshStatus);
});

function refreshStatus() {
  if (!toggle.checked) {
    setStatus("Off — TikTok's own layout menu still works.", false);
    return;
  }
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || !TIKTOK_RE.test(tab.url || "")) {
      setStatus("On — open a TikTok live to apply.", false);
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: "vltok:status" }, (resp) => {
      if (chrome.runtime.lastError || !resp) {
        // Content script not ready (page loaded before install / needs refresh).
        setStatus("On — refresh the live tab to apply.", false);
        return;
      }
      if (!resp.isLive) {
        setStatus("On — this tab isn't a live page.", false);
      } else if (resp.applied) {
        setStatus("Active — vertical layout applied ✓", true);
      } else {
        setStatus("Active — applying on this live…", false);
      }
    });
  });
}
