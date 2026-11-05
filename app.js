// 🧸 Teady Bear-MD — frontend (number → code → connect)
const $ = (s) => document.querySelector(s);
const LS_API = "teady.api";
const LS_THEME = "teady.theme";

const state = { api: "", code: "", pairing: false, timer: null };

/* ── helpers ── */
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 1800);
}

const normUrl = (u) => String(u || "").trim().replace(/\/+$/, "");
const isHttps = (u) => /^https:\/\//i.test(u);

function setMsg(text, kind) {
  const el = $("#pair-msg");
  el.textContent = text || "";
  el.className = "msg" + (kind ? " " + kind : "");
}

async function copyText(txt) {
  if (!txt) return false;
  try {
    await navigator.clipboard.writeText(txt);
    return true;
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = txt;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/* ── theme ── */
function initTheme() {
  if (localStorage.getItem(LS_THEME) === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  }
  const btn = $("#theme-toggle");
  const sync = () => {
    btn.textContent = document.documentElement.getAttribute("data-theme") === "light" ? "☀️" : "🌙";
  };
  sync();
  btn.addEventListener("click", () => {
    const light = document.documentElement.getAttribute("data-theme") === "light";
    if (light) {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem(LS_THEME, "dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem(LS_THEME, "light");
    }
    sync();
  });
}

/* ── config (local file + optional cloud gist) ── */
async function loadConfig() {
  let cfg = {};
  try {
    const r = await fetch("config.json", { cache: "no-store" });
    if (r.ok) cfg = await r.json();
  } catch {}
  if (cfg.configGist) {
    try {
      const r = await fetch(cfg.configGist, { cache: "no-store" });
      if (r.ok) cfg = { ...cfg, ...(await r.json()) };
    } catch {}
  }
  return cfg;
}

function applyConfig(cfg) {
  if (cfg.telegram) $("#tg-link").href = cfg.telegram;
  if (cfg.channel) $("#ch-link").href = cfg.channel;
  $("#year").textContent = new Date().getFullYear();
}

/* ── server select ── */
function buildServerOptions(cfg) {
  const sel = $("#server-select");
  const saved = localStorage.getItem(LS_API) || "";
  sel.innerHTML = "";

  const add = (label, value) => {
    const o = document.createElement("option");
    o.textContent = label;
    o.value = value;
    sel.appendChild(o);
  };

  add("Default", "");
  const servers = (cfg.servers || []).filter((s) => s && s.url);
  for (const s of servers) add(s.name || s.url, normUrl(s.url));

  if (saved && ![...sel.options].some((o) => o.value === saved)) {
    add("My server", saved);
  }
  sel.value = saved;
}

function setApi(url, { quiet } = {}) {
  const u = normUrl(url);
  state.api = u;
  u ? localStorage.setItem(LS_API, u) : localStorage.removeItem(LS_API);

  if (!quiet) {
    setMsg(u ? "Server ready ✓" : "", u ? "ok" : "");
    if (u) toast("Server set ✓");
  }
  refreshStatus();
}

/* ── status ── */
async function getStatus(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const r = await fetch(url + "/status", { signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function paint(s) {
  const dot = $("#hero-dot");
  const badge = $("#badge-text");
  if (!s) {
    dot.className = "dot bad";
    badge.textContent = state.api ? "Server offline" : "Select a server";
    return;
  }
  dot.className = "dot " + (s.linked ? "ok" : "");
  badge.textContent = s.linked
    ? `Online · ${s.commands ?? 0} commands · ${s.sessions ?? 0} linked`
    : `Online · ${s.commands ?? 0} commands`;
}

async function refreshStatus() {
  clearTimeout(state.timer);
  if (!state.api) {
    paint(null);
    state.timer = setTimeout(refreshStatus, 15000);
    return;
  }
  try {
    paint(await getStatus(state.api));
  } catch {
    paint(null);
  }
  state.timer = setTimeout(refreshStatus, 15000);
}

/* ── pairing ── */
async function pair(phone) {
  if (state.pairing) return;
  if (!state.api) {
    setMsg("Select a server first (or add your own URL).", "err");
    return;
  }
  const num = String(phone || "").replace(/[^0-9]/g, "");
  if (num.length < 8 || num.length > 15) {
    setMsg("Invalid number — include the country code.", "err");
    return;
  }

  state.pairing = true;
  const btn = $("#pair-btn");
  btn.disabled = true;
  btn.textContent = "Wait…";
  setMsg("Generating code (10–20s)…");
  $("#code-box").hidden = true;

  try {
    const r = await fetch(state.api + "/pair?phone=" + encodeURIComponent(num), { cache: "no-store" });
    let d = {};
    try {
      d = await r.json();
    } catch {}

    if (!r.ok || d.error) {
      setMsg("❌ " + (d.error || "Failed (HTTP " + r.status + ")"), "err");
    } else if (d.code) {
      state.code = d.code;
      $("#code").textContent = d.code;
      $("#code-box").hidden = false;
      setMsg("✅ Code ready — enter it in WhatsApp.", "ok");
      const copied = await copyText(d.code);
      toast(copied ? "Code copied ✓" : "Tap the code to copy");
      refreshStatus();
    } else {
      setMsg("❌ No code received — please try again.", "err");
    }
  } catch {
    setMsg("❌ Couldn't reach the server — check the URL.", "err");
  } finally {
    state.pairing = false;
    btn.disabled = false;
    btn.textContent = "Get code";
  }
}

/* ── init ── */
(async function init() {
  initTheme();

  const cfg = await loadConfig();
  applyConfig(cfg);
  buildServerOptions(cfg);

  const qApi = new URLSearchParams(location.search).get("api");
  const start = normUrl(qApi || localStorage.getItem(LS_API) || "");
  if (qApi) localStorage.setItem(LS_API, start);
  if (start) {
    $("#custom-server").value = start;
    setApi(start, { quiet: true });
  } else {
    paint(null);
    refreshStatus();
  }

  $("#server-select").addEventListener("change", (e) => {
    if (!e.target.value) {
      setMsg("No default server yet — add your own URL.", "");
      state.api = "";
      localStorage.removeItem(LS_API);
      paint(null);
      return;
    }
    setApi(e.target.value);
  });

  $("#toggle-custom").addEventListener("click", () => {
    const w = $("#custom-wrap");
    w.hidden = !w.hidden;
  });

  $("#save-custom").addEventListener("click", () => {
    const u = normUrl($("#custom-server").value);
    if (!/^https?:\/\/.+\..+/i.test(u)) {
      toast("Enter a full URL (https://…)");
      return;
    }
    if (!isHttps(u)) toast("⚠️ Use HTTPS or the browser will block it");
    const sel = $("#server-select");
    if (![...sel.options].some((o) => o.value === u)) {
      const o = document.createElement("option");
      o.textContent = "My server";
      o.value = u;
      sel.appendChild(o);
    }
    sel.value = u;
    $("#custom-wrap").hidden = true;
    setApi(u);
  });

  $("#pair-form").addEventListener("submit", (e) => {
    e.preventDefault();
    pair($("#phone").value);
  });

  $("#copy-btn").addEventListener("click", async () => {
    const ok = await copyText(state.code);
    toast(ok ? "Copied ✓" : "Copy failed — tap the code");
  });
  $("#code").addEventListener("click", async () => {
    if (await copyText(state.code)) toast("Copied ✓");
  });
})();
