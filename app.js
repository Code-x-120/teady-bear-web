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
function hostOf(u) {
  try {
    return new URL(u).host;
  } catch {
    return u;
  }
}

function normalizeInput(raw) {
  let u = String(raw || "").trim();
  if (!u) return "";
  if (!/^[a-z]+:\/\//i.test(u)) u = "https://" + u;
  return normUrl(u);
}

function addOption(sel, label, value) {
  const o = document.createElement("option");
  o.textContent = label;
  o.value = value;
  sel.appendChild(o);
  return o;
}

/* ── owner mode + servers ── */
const LS_SERVERS = "teady.servers";
const LS_ADMIN = "teady.owner";

function adminHash() {
  return String(state.cfg?.adminKeyHash || "").trim().toLowerCase();
}

async function sha256(text) {
  const data = new TextEncoder().encode(String(text));
  if (globalThis.crypto?.subtle) {
    const buf = await globalThis.crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return "";
}

async function isOwnerKey(typed) {
  const hash = adminHash();
  const clean = String(typed || "").trim();
  if (!hash || !clean) return false;
  return (await sha256(clean)) === hash;
}

function isAdmin() {
  return !!adminHash() && localStorage.getItem(LS_ADMIN) === "1";
}

function ownerServers() {
  try {
    const list = JSON.parse(localStorage.getItem(LS_SERVERS) || "[]");
    return Array.isArray(list) ? list.filter((s) => s && s.url) : [];
  } catch {
    return [];
  }
}

function saveOwnerServers(list) {
  localStorage.setItem(LS_SERVERS, JSON.stringify(list));
}

function buildServerOptions(cfg) {
  const sel = $("#server-select");
  const saved = localStorage.getItem(LS_API) || "";
  sel.innerHTML = "";

  const list = [];
  const push = (name, url) => {
    const u = normUrl(url);
    if (!u || list.some((s) => s.url === u)) return;
    list.push({ name: String(name || "").trim(), url: u });
  };

  for (const s of cfg.servers || []) if (s && s.url) push(s.name, s.url);
  if (isAdmin()) for (const s of ownerServers()) push(s.name, s.url);
  else for (const s of ownerServers()) if (s.public) push(s.name, s.url);

  // naam na ho to Server 1, Server 2...
  list.forEach((s, i) => {
    if (!s.name) s.name = `Server ${i + 1}`;
  });

  for (const s of list) addOption(sel, s.name, s.url);

  if (saved && !list.some((s) => s.url === saved)) {
    addOption(sel, "Saved · " + hostOf(saved), saved);
  }

  if (!list.length && !saved) addOption(sel, "No server configured", "");

  sel.value = saved || (list[0] ? list[0].url : "");
  updateAdminUi();
}

function updateAdminUi() {
  const admin = isAdmin();
  $("#toggle-custom").hidden = !admin;
  $("#copy-gist").hidden = !admin;
  if (!admin) $("#custom-wrap").hidden = true;

  // owner key UI
  $("#owner-toggle").hidden = admin;
  $("#owner-state").hidden = !admin;
  $("#owner-exit").hidden = !admin;
  if (admin) {
    $("#owner-wrap").hidden = true;
    $("#owner-key").value = "";
  }
}

function setAdmin(on) {
  if (on) localStorage.setItem(LS_ADMIN, "1");
  else localStorage.removeItem(LS_ADMIN);
  buildServerOptions(state.cfg || {});
  return true;
}

function setApi(url, { quiet } = {}) {
  const u = normUrl(url);
  state.api = u;
  u ? localStorage.setItem(LS_API, u) : localStorage.removeItem(LS_API);

  if (!quiet) {
    setMsg(u ? "Checking server…" : "", "");
    if (u) toast("Server set ✓");
  }
  refreshStatus();
  if (u && !quiet) probeAndReport(u);
}

/* error text — browser ka asli reason dikhao */
function reasonOf(e) {
  if (e?.name === "AbortError") return "timeout — server respond nahi kar raha";
  if (e instanceof TypeError) return "network/CORS — link dead ya bot off hai";
  return e?.message || "unknown error";
}

async function probeAndReport(u) {
  try {
    const s = await getStatus(u, 12000);
    setMsg(`✅ Server online · ${s.commands ?? 0} commands`, "ok");
    paint(s);
    return true;
  } catch (e) {
    setMsg(`⚠️ ${reasonOf(e)}. Link purana ho sakta hai — naya daalo.`, "err");
    paint(null);
    return false;
  }
}

/* ── status ── */
async function getStatus(url, timeout = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
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
    let r = null;
    let lastErr = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 45000);
        try {
          r = await fetch(state.api + "/pair?phone=" + encodeURIComponent(num), {
            signal: ctrl.signal,
            cache: "no-store",
          });
        } finally {
          clearTimeout(t);
        }
        break;
      } catch (e) {
        lastErr = e;
        if (attempt === 0) {
          setMsg("Connection slow — retrying…");
          await new Promise((res) => setTimeout(res, 1500));
        }
      }
    }

    if (!r) throw lastErr || new Error("network");

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
  } catch (e) {
    setMsg(`❌ ${reasonOf(e)}. Check the server URL.`, "err");
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
  state.cfg = cfg;
  applyConfig(cfg);

  // owner mode: ?admin=KEY (ek dafa) — sirf owner server add kar sakta hai
  const adminParam = new URLSearchParams(location.search).get("admin");
  if (adminParam) {
    if (await isOwnerKey(adminParam)) {
      setAdmin(true);
      setTimeout(() => toast("Owner mode on ✓"), 300);
    } else {
      setAdmin(false);
      setTimeout(() => toast("Wrong owner key"), 300);
    }
  }

  buildServerOptions(cfg);

  const qApi = new URLSearchParams(location.search).get("api");
  const first = (cfg.servers || []).find((s) => s && s.url);
  const start = normalizeInput(qApi || localStorage.getItem(LS_API) || (first ? first.url : ""));

  if (start) {
    $("#custom-server").value = start;
    $("#server-select").value = start;
    setApi(start, { quiet: true });
  } else {
    paint(null);
    refreshStatus();
    setMsg("Add your server URL below to start.", "");
  }

  $("#server-select").addEventListener("change", (e) => {
    if (!e.target.value) {
      state.api = "";
      localStorage.removeItem(LS_API);
      paint(null);
      $("#custom-wrap").hidden = false;
      setMsg("Enter your bot URL below.", "");
      return;
    }
    setApi(e.target.value);
  });

  $("#toggle-custom").addEventListener("click", () => {
    const w = $("#custom-wrap");
    w.hidden = !w.hidden;
    if (!w.hidden) $("#custom-server").focus();
  });

  /* ── owner key (unlock / sign out) ── */
  $("#owner-toggle").addEventListener("click", () => {
    const w = $("#owner-wrap");
    w.hidden = !w.hidden;
    if (!w.hidden) $("#owner-key").focus();
  });

  async function tryUnlock() {
    if (!adminHash()) {
      toast("Owner key not configured");
      return;
    }
    if (await isOwnerKey($("#owner-key").value)) {
      setAdmin(true);
      $("#owner-wrap").hidden = true;
      $("#owner-key").value = "";
      toast("Owner mode on ✓");
      return;
    }
    toast("Wrong owner key");
  }

  $("#owner-unlock").addEventListener("click", tryUnlock);
  $("#owner-key").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      tryUnlock();
    }
  });

  $("#owner-exit").addEventListener("click", () => {
    setAdmin(false);
    toast("Owner mode off");
  });

  async function saveCustom() {
    if (!isAdmin()) {
      toast("Owner key required");
      return;
    }
    const u = normalizeInput($("#custom-server").value);
    const name = String($("#custom-name").value || "").trim().slice(0, 24);

    if (!/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(u)) {
      toast("Enter a valid URL, e.g. my-bot.up.railway.app");
      return;
    }
    if (!isHttps(u)) toast("⚠️ Use HTTPS or the browser will block it");

    const list = ownerServers();
    const existing = list.find((s) => normUrl(s.url) === u);
    if (existing) {
      if (name) existing.name = name;
    } else {
      list.push({ name: name || `Server ${list.length + 1}`, url: u });
    }
    saveOwnerServers(list);

    buildServerOptions(state.cfg);
    $("#server-select").value = u;
    $("#custom-wrap").hidden = true;
    $("#custom-name").value = "";
    $("#custom-server").value = "";
    toast("Server saved ✓");
    setApi(u);
  }

  $("#copy-gist").addEventListener("click", async () => {
    if (!isAdmin()) return;
    const json = JSON.stringify({ servers: ownerServers() }, null, 2);
    const ok = await copyText(json);
    toast(ok ? "JSON copied — gist me paste karo" : "Copy failed");
  });

  $("#test-server").addEventListener("click", async () => {    if (!state.api) {
      setMsg("No server configured yet.", "err");
      return;
    }
    setMsg("Testing…");
    const ok = await probeAndReport(state.api);
    toast(ok ? "Server online ✓" : "Server not reachable");
  });

  $("#save-custom").addEventListener("click", saveCustom);
  $("#custom-server").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveCustom();
    }
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
