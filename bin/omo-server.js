#!/usr/bin/env node
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

// ── Paths ────────────────────────────────────────────────────────────────────
const PRESET_DIR = path.join(__dirname, "..", "lib", "presets");
const ICON_FILE = path.join(__dirname, "..", "favicon.ico");
const HELP_FILE = path.join(__dirname, "..", "lib", "help.json");
const CONFIG_DIR = path.join(os.homedir(), ".config", "opencode");
const LIVE_FILE = path.join(CONFIG_DIR, "oh-my-opencode.jsonc");
const ROLE_NAME_FILE = path.join(CONFIG_DIR, "oh-my-opencode-role-name.json");

// ── Help Data ─────────────────────────────────────────────────────────────────
const HELP_DATA = JSON.parse(fs.readFileSync(HELP_FILE, "utf8"));
const ALIAS_FILE = path.join(PRESET_DIR, "aliases.json");

const DEFAULT_PORT = 1314;
const MAX_RETRIES = 5;
const HOST = process.env.HOST || "0.0.0.0";

// ── CLI Args ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let port = DEFAULT_PORT;
let retryCount = 0;
let lang = "zh";

for (const arg of args) {
  if (/^\d+$/.test(arg)) {
    port = parseInt(arg, 10);
  } else if (arg === "-e" || arg === "--en") {
    lang = "en";
  }
}

// ── i18n ──────────────────────────────────────────────────────────────────────
// Override lang variable for request
const I18N = {
  zh: {
    title: "OMO Config Switcher",
    subtitle: "OpenCode oh-my-opencode 预设管理器",
    current: "当前",
    noConfig: "[无配置]",
    noProject: "[无项目配置]",
    loading: "加载中...",
    switchTo: "已切换至: ",
    switchFail: "切换失败",
    loadFail: "加载失败",
    apiError: "请求失败",
    portInUse: "端口已被占用，自动重试",
    allPortsFailed: "启动失败，所有端口均被占用",
    tryOther: "请释放端口或手动指定: node omo-server.js <端口>",
    presets: "预设",
    categories: "分类",
    footer: "Powered by ezcoder-omo-config",
    footerRepo: "GitHub"
  },
  en: {
    title: "OMO Config Switcher",
    subtitle: "OpenCode oh-my-opencode preset manager",
    current: "Current",
    noConfig: "[No config]",
    noProject: "[No project config]",
    loading: "Loading...",
    switchTo: "Switched to: ",
    switchFail: "Switch failed",
    loadFail: "Load failed",
    apiError: "Request failed",
    portInUse: "Port in use, retrying",
    allPortsFailed: "Failed to start: all ports in use",
    tryOther: "Free a port or specify one: node omo-server.js <port>",
    presets: "Presets",
    categories: "Categories",
    footer: "Powered by ezcoder-omo-config",
    footerRepo: "GitHub"
  }
};
const i = I18N[lang] || I18N.zh;

// ── Utilities ─────────────────────────────────────────────────────────────────
function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function getCurrentName() {
  const role = readJSON(ROLE_NAME_FILE);
  return role && role.role ? role.role : null;
}

function getAliases() {
  return readJSON(ALIAS_FILE) || {};
}

function resolveName(input) {
  const aliases = getAliases();
  for (const [name, list] of Object.entries(aliases)) {
    if (name === input || (Array.isArray(list) && list.includes(input))) {
      return name;
    }
  }
  return null;
}

function switchPreset(name) {
  const presetFile = path.join(PRESET_DIR, `${name}.json`);
  if (!fs.existsSync(presetFile)) return false;

  const preset = readJSON(presetFile);
  const { _omo_name, ...cleanPreset } = preset || {};
  writeJSON(LIVE_FILE, cleanPreset);
  writeJSON(ROLE_NAME_FILE, { role: name });
  return true;
}

function getPresetList() {
  const aliases = getAliases();
  const files = fs.readdirSync(PRESET_DIR).filter((f) => f.endsWith(".json") && f !== "aliases.json");
  const currentName = getCurrentName();

  return files.map((file) => {
    const name = path.basename(file, ".json");
    const preset = readJSON(path.join(PRESET_DIR, file));
    const al = aliases[name];
    return {
      name,
      aliases: al || [],
      isCurrent: name === currentName,
      agents: preset?.agents || {},
      categories: preset?.categories || {}
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function getCurrentConfig() {
  const config = readJSON(LIVE_FILE);
  const name = getCurrentName();
  const aliases = getAliases();
  return {
    name,
    aliases: aliases[name] || [],
    config
  };
}

// ── i18n ──────────────────────────────────────────────────────────────────────
const LANG = {
  current: { zh: "当前", en: "Current" },
  currentLabel: { zh: "当前配置：", en: "Current: " },
  loading: { zh: "加载中...", en: "Loading..." },
  active: { zh: "使用中", en: "ACTIVE" },
  switchTo: { zh: "已切换至：", en: "Switched to: " },
  switchDone: { zh: "预设切换成功！", en: "Done!" },
  failLoad: { zh: "加载失败", en: "Load failed" },
  failSwitch: { zh: "切换失败", en: "Switch failed" },
  poweredBy: { zh: "Powered by", en: "Powered by" },
  helpTitle: { zh: "帮助", en: "Help" }
};

function makeHTML(lang) {
  const t = (key) => (LANG[key] && LANG[key][lang]) || (LANG[key] && LANG[key].en) || key;
  const otherLang = lang === "en" ? "zh" : "en";
  return `<!DOCTYPE html>
<html lang="${lang === "en" ? "en" : "zh-CN"}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${lang === "en" ? HELP_DATA.title.en : HELP_DATA.title.zh}</title>
  <link rel="icon" href="/favicon.ico">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
    .container { max-width: 900px; margin: 0 auto; padding: 2rem; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; }
    h1 { font-size: 1.5rem; color: #f8fafc; }
    .lang-btn { display: flex; gap: 0; border-radius: 6px; overflow: hidden; font-size: 0.75rem; }
    .lang-btn { display: flex; align-items: center; gap: 0.3rem; }
    .lang-btn a { text-decoration: none; color: #64748b; font-size: 0.75rem; transition: color 0.2s; }
    .lang-btn a.active { color: #f8fafc; font-weight: 700; }
    .lang-btn a:hover:not(.active) { color: #94a3b8; }
    .lang-btn span { color: #334155; font-size: 0.75rem; user-select: none; }
    .subtitle { color: #94a3b8; font-size: 0.875rem; margin-bottom: 2rem; }

    .current-bar { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem; }
    .current-bar .label { color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .current-bar .name { font-size: 1.125rem; font-weight: 600; color: #38bdf8; }
    .current-bar .aliases { color: #64748b; font-size: 0.875rem; }

    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
    .card { background: #1e293b; border: 2px solid #334155; border-radius: 12px; padding: 1.25rem; cursor: pointer; transition: all 0.2s; position: relative; }
    .card:hover { border-color: #38bdf8; transform: translateY(-2px); }
    .card.active { border-color: #eab308; background: #1a1a0f; }
    .card.active::after { content: '${t("active")}'; position: absolute; top: 0.75rem; right: 0.75rem; background: #eab308; color: #0f172a; font-size: 0.625rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 4px; letter-spacing: 0.05em; }
    .card-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
    .card-name { font-size: 1rem; font-weight: 600; color: #f8fafc; }
    .card-aliases { font-size: 0.75rem; color: #64748b; }
    .card-agents { font-size: 0.75rem; color: #94a3b8; line-height: 1.6; }
    .card-agent { display: flex; gap: 0.5rem; }
    .card-agent .role { color: #38bdf8; min-width: 90px; }

    .loading { text-align: center; padding: 3rem; color: #64748b; }
    .error { background: #3b1a1a; border: 1px solid #7f1d1d; border-radius: 8px; padding: 1rem; color: #fca5a5; margin-bottom: 1rem; }
    .success { background: #14321a; border: 1px solid #14532d; border-radius: 8px; padding: 1rem; color: #86efac; margin-bottom: 1rem; text-align: center; }
    .toast { position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%); background: #1e293b; border: 1px solid #38bdf8; border-radius: 8px; padding: 0.75rem 1.5rem; font-size: 0.875rem; opacity: 0; transition: opacity 0.3s; pointer-events: none; z-index: 100; }
    .toast.show { opacity: 1; }

    .footer { text-align: center; margin-top: 3rem; color: #475569; font-size: 0.75rem; }
    .footer a { color: #38bdf8; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }

    .help-btn { position: fixed; bottom: 1.5rem; right: 1.5rem; width: 2.5rem; height: 2.5rem; border-radius: 50%; background: #1e293b; border: 1px solid #334155; color: #64748b; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
    .help-btn:hover { border-color: #38bdf8; color: #38bdf8; background: #1e293b; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: none; align-items: center; justify-content: center; z-index: 200; }
    .modal-overlay.show { display: flex; }
    .modal { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 1.5rem; max-width: 420px; width: 90%; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    .modal-title { font-size: 1rem; font-weight: 600; color: #f8fafc; }
    .modal-close { background: none; border: none; color: #64748b; font-size: 1.25rem; cursor: pointer; padding: 0; line-height: 1; }
    .modal-close:hover { color: #f8fafc; }
    .modal-body { color: #94a3b8; font-size: 0.875rem; line-height: 1.6; }
    .modal-body p { margin-bottom: 0.75rem; }
    .modal-body a { color: #38bdf8; }
    .modal-body strong { color: #e2e8f0; }
    .modal-github { margin-top: 1rem; text-align: center; }
    .modal-body code { background: #0f172a; padding: 0.1rem 0.4rem; border-radius: 4px; color: #38bdf8; font-size: 0.8rem; }

  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🤖 OMO Config Switcher</h1>
      <div class="lang-btn">
        <a href="?lang=en" ${lang === "en" ? 'class="active"' : ""}>EN</a>
        <span>/</span>
        <a href="?lang=zh" ${lang === "zh" ? 'class="active"' : ""}>中文</a>
      </div>
    </div>
    <p class="subtitle">${lang === "en" ? HELP_DATA.subtitle.en : HELP_DATA.subtitle.zh}</p>

    <div id="currentBar" class="current-bar">
      <span class="name" id="currentName">-</span>
      <span class="aliases" id="currentAliases"></span>
    </div>

    <div id="errorBox" class="error" style="display:none"></div>
    <div id="successBox" class="success" style="display:none"></div>

    <div class="grid" id="grid">
      <div class="loading">${t("loading")}</div>
    </div>

    <div class="footer">
      ${t("poweredBy")} <a href="https://github.com/ez-coder-admin/ezcoder-omo-config" target="_blank">ezcoder-omo-config</a>
    </div>
  </div>

  <button class="help-btn" id="helpBtn" title="Help">?</button>

  <div class="modal-overlay" id="modalOverlay">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">${t("helpTitle")}</span>
        <button class="modal-close" id="modalClose">&times;</button>
      </div>
      <div class="modal-body">
        <p>${lang === "en" ? HELP_DATA.helpPage.desc_en : HELP_DATA.helpPage.desc_zh}</p>
        <p>${lang === "en" ? HELP_DATA.helpPage.note_en : HELP_DATA.helpPage.note_zh}</p>
        <p><strong>${lang === "en" ? HELP_DATA.helpPage.section_switch_en : HELP_DATA.helpPage.section_switch_zh}</strong></p>
        ${HELP_DATA.usage.filter(u => !u.cmd.includes("-config") && u.cmd !== "omo").map(u => `<p><code>${u.cmd}</code> — ${lang === "en" ? u.desc_en : u.desc_zh}</p>`).join("")}
        <p><strong>${lang === "en" ? HELP_DATA.helpPage.section_list_en : HELP_DATA.helpPage.section_list_zh}</strong></p>
        ${HELP_DATA.usage.filter(u => u.cmd.includes("-l")).map(u => `<p><code>${u.cmd}</code> — ${lang === "en" ? u.desc_en : u.desc_zh}</p>`).join("")}
        <p><strong>${lang === "en" ? HELP_DATA.helpPage.section_web_en : HELP_DATA.helpPage.section_web_zh}</strong></p>
        ${HELP_DATA.usage.filter(u => u.cmd.includes("-config")).map(u => `<p><code>${u.cmd}</code> — ${lang === "en" ? u.desc_en : u.desc_zh}</p>`).join("")}
        <p class="modal-github"><a href="https://github.com/ez-coder-admin/ezcoder-omo-config" target="_blank">${lang === "en" ? HELP_DATA.helpPage.github_en : HELP_DATA.helpPage.github_zh}</a></p>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    const pageLang = "${lang}";
    const LANG = ${JSON.stringify(LANG)};
    const t = (key) => LANG[key] && LANG[key][pageLang] || LANG[key] && LANG[key].en || key;
    const $ = (s) => document.querySelector(s);
    let currentName = '';

    function toast(msg) {
      const t = $('#toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2000);
    }

    function showError(msg) {
      $('#errorBox').textContent = msg;
      $('#errorBox').style.display = 'block';
      setTimeout(() => $('#errorBox').style.display = 'none', 5000);
    }

    function showSuccess(msg) {
      $('#successBox').textContent = msg;
      $('#successBox').style.display = 'block';
      setTimeout(() => $('#successBox').style.display = 'none', 3000);
    }

    function renderCard(p) {
      const agents = Object.entries(p.agents).slice(0, 4);
      const lines = agents.map(([role, v]) =>
        '<div class="card-agent"><span class="role">' + role + '</span><span>' + v.model + '</span></div>'
      ).join('');
      const aliases = p.aliases.length ? '(' + p.aliases.join(', ') + ')' : '';
      const cls = p.isCurrent ? 'card active' : 'card';
      return '<div class="' + cls + '" data-name="' + p.name + '">' +
        '<div class="card-header">' +
          '<span class="card-name">' + p.name + '</span>' +
          (aliases ? '<span class="card-aliases">' + aliases + '</span>' : '') +
        '</div>' +
        '<div class="card-agents">' + lines + '</div>' +
      '</div>';
    }

    function renderCurrent(data) {
      const name = data.name ? t("currentLabel") + data.name : '-';
      const aliases = data.aliases.length ? ' (' + data.aliases.join(', ') + ')' : '';
      $('#currentName').textContent = name;
      $('#currentAliases').textContent = aliases;
      currentName = data.name || '';
    }

    async function load() {
      try {
        const [presetsRes, currentRes] = await Promise.all([
          fetch('/api/presets'),
          fetch('/api/current')
        ]);
        const presets = await presetsRes.json();
        const current = await currentRes.json();

        renderCurrent(current);
        $('#grid').innerHTML = presets.map(renderCard).join('');

        $('#grid').querySelectorAll('.card').forEach(card => {
          card.addEventListener('click', () => switchPreset(card.dataset.name));
        });
      } catch (e) {
        showError(t("failLoad") + ": " + e.message);
      }
    }

    async function switchPreset(name) {
      if (name === currentName) return;
      try {
        const res = await fetch('/api/switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("failSwitch"));
        showSuccess(t("switchTo") + name);
        load();
        toast(t("switchDone"));
      } catch (e) {
        showError(e.message);
      }
    }

    load();

    $('#helpBtn').addEventListener('click', () => {
      $('#modalOverlay').classList.add('show');
    });
    $('#modalClose').addEventListener('click', () => {
      $('#modalOverlay').classList.remove('show');
    });
    $('#modalOverlay').addEventListener('click', (e) => {
      if (e.target === $('#modalOverlay')) $('#modalOverlay').classList.remove('show');
    });
  </script>
</body>
</html>`;
}

// ── Server ────────────────────────────────────────────────────────────────────
function handle(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${HOST}:${port}`);
  const pageLang = url.searchParams.get("lang") === "en" ? "en" : "zh";

  // GET / → HTML page
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(makeHTML(pageLang));
    return;
  }

  // GET /favicon.ico
  if (req.method === "GET" && url.pathname === "/favicon.ico") {
    if (fs.existsSync(ICON_FILE)) {
      res.writeHead(200, { "Content-Type": "image/x-icon" });
      res.end(fs.readFileSync(ICON_FILE));
    } else {
      res.writeHead(404);
      res.end();
    }
    return;
  }

  // GET /api/presets
  if (req.method === "GET" && url.pathname === "/api/presets") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(getPresetList()));
    return;
  }

  // GET /api/current
  if (req.method === "GET" && url.pathname === "/api/current") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(getCurrentConfig()));
    return;
  }

  // POST /api/switch
  if (req.method === "POST" && url.pathname === "/api/switch") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { name } = JSON.parse(body);
        if (!name) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "name is required" }));
          return;
        }
        const resolved = resolveName(name);
        if (!resolved) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: `Preset not found: ${name}` }));
          return;
        }
        const ok = switchPreset(resolved);
        if (!ok) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: `Preset file not found: ${resolved}` }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, name: resolved }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404);
  res.end("Not Found");
}

const server = http.createServer(handle);

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    if (retryCount < MAX_RETRIES) {
      const tried = port;
      port += 100;
      retryCount++;
      console.log(`  ${i.portInUse} :${port} ...`);
      server.listen(port, HOST);
      return;
    }
    console.error(`\n  ${i.allPortsFailed}`);
    console.error(`  ${i.tryOther}\n`);
    process.exit(1);
  }
  throw e;
});

server.listen(port, HOST, () => {
  const url = `http://127.0.0.1:${port}`;
  console.log(`\n  OMO Config Switcher Web UI\n`);
  console.log(`  Local:  ${url}\n`);
  console.log(`  Presets: ${PRESET_DIR}`);
  console.log(`  Config:  ${LIVE_FILE}\n`);
  console.log(`  Stop: Ctrl+C\n`);
  openBrowser(url);
});

function openBrowser(url) {
  const plat = process.platform;
  try {
    if (plat === "win32") {
      execSync(`start "" "${url}"`, { stdio: "ignore" });
    } else if (plat === "darwin") {
      execSync(`open "${url}"`, { stdio: "ignore" });
    } else {
      execSync(`xdg-open "${url}"`, { stdio: "ignore" });
    }
  } catch {}
}

server.listen(port, HOST, () => {
  const url = `http://127.0.0.1:${port}`;
  console.log(`\n  OMO Config Switcher Web UI\n`);
  console.log(`  Local:  ${url}\n`);
  console.log(`  Presets: ${PRESET_DIR}`);
  console.log(`  Config:  ${LIVE_FILE}\n`);
  console.log(`  Stop: Ctrl+C\n`);
  openBrowser(url);
});
