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
const CUSTOM_PRESETS_DIR = path.join(CONFIG_DIR, "omo-custom-presets");
const ORDER_FILE = path.join(CONFIG_DIR, "omo-preset-order.json");
const DEFAULT_ORDER = ["default", "mimo", "gpt-mini", "gpt", "code"];

// Ensure custom presets directory exists
if (!fs.existsSync(CUSTOM_PRESETS_DIR)) {
  fs.mkdirSync(CUSTOM_PRESETS_DIR, { recursive: true });
}

// ── Custom Presets Functions ───────────────────────────────────────────────
function getCustomPresets() {
  const files = fs.readdirSync(CUSTOM_PRESETS_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(CUSTOM_PRESETS_DIR, f), 'utf8'));
    const name = f.replace('.json', '');
    return { name, ...data };
  });
}

function saveCustomPreset(name, data) {
  const file = path.join(CUSTOM_PRESETS_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function deleteCustomPreset(name) {
  const file = path.join(CUSTOM_PRESETS_DIR, `${name}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function isCustomPreset(name) {
  return fs.existsSync(path.join(CUSTOM_PRESETS_DIR, `${name}.json`));
}

function readOrder() {
  try { return JSON.parse(fs.readFileSync(ORDER_FILE, "utf8")); } catch { return null; }
}

function saveOrder(order) {
  fs.writeFileSync(ORDER_FILE, JSON.stringify(order, null, 2), "utf8");
}

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
  helpTitle: { zh: "帮助", en: "Help" },
  addPreset: { zh: "添加配置", en: "Add Preset" },
  editPreset: { zh: "编辑配置", en: "Edit Preset" },
  presetName: { zh: "配置名称", en: "Preset Name" },
  presetNameHint: { zh: "只允许字母、数字、下划线、连字符", en: "Letters, numbers, - and _ only" },
  presetNote: { zh: "备注（可选）", en: "Note (Optional)" },
  presetNoteHint: { zh: "给这个配置添加备注", en: "Add a note for this preset" },
  presetAliases: { zh: "别名（可选）", en: "Aliases (Optional)" },
  presetAliasesHint: { zh: "逗号分隔，如: my, test", en: "Comma separated, e.g.: my, test" },
  agents: { zh: "Agents (JSON)", en: "Agents (JSON)" },
  agentsHint: { zh: "键值对格式，如: {\"Sisyphus\": {\"model\": \"claude-3-5-sonnet-20241002\"}}", en: "Key-value format, e.g.: {\"Sisyphus\": {\"model\": \"claude-3-5-sonnet-20241002\"}}" },
  categories: { zh: "Categories (JSON)", en: "Categories (JSON)" },
  categoriesHint: { zh: "可选，如: {\"deep\": \"ultrabrain\"}", en: "Optional, e.g.: {\"deep\": \"ultrabrain\"}" },
  save: { zh: "保存", en: "Save" },
  cancel: { zh: "取消", en: "Cancel" },
  delete: { zh: "删除", en: "Delete" },
  deleteConfirm: { zh: "确定删除此配置？", en: "Delete this preset?" },
  saveSuccess: { zh: "保存成功！", en: "Saved!" },
  deleteSuccess: { zh: "已删除", en: "Deleted" },
  nameRequired: { zh: "请输入配置名称", en: "Name is required" },
  agentsRequired: { zh: "请输入agents内容", en: "Agents content is required" },
  invalidJson: { zh: "JSON格式无效", en: "Invalid JSON format" },
  custom: { zh: "自定义", en: "Custom" }
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

    .card.custom { border-style: dashed; }
    .card.custom::before { content: 'Custom'; position: absolute; top: 0.75rem; left: 0.75rem; background: #7c3aed; color: #fff; font-size: 0.625rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 4px; letter-spacing: 0.05em; }
    .edit-btn { position: absolute; bottom: 0.75rem; right: 0.75rem; background: #1e293b; color: #64748b; border: 1px solid #334155; width: 1.5rem; height: 1.5rem; border-radius: 4px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .edit-btn:hover { border-color: #38bdf8; color: #38bdf8; }
    .card { cursor: grab; }
    .card:active { cursor: grabbing; }
    .card.dragging { opacity: 0.5; transform: scale(0.98); }

  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🤖 OMO Config Switcher</h1>
      <div class="header-actions">
        <button class="add-btn" id="addPresetBtn">+ ${lang === "en" ? "Add Preset" : "添加配置"}</button>
        <div class="lang-btn">
          <a href="?lang=en" ${lang === "en" ? 'class="active"' : ""}>EN</a>
          <span>/</span>
          <a href="?lang=zh" ${lang === "zh" ? 'class="active"' : ""}>中文</a>
        </div>
      </div>
    </div>
    <p class="subtitle">${lang === "en" ? HELP_DATA.subtitle.en : HELP_DATA.subtitle.zh}</p>

    <div id="currentBar" class="current-bar">
      <span class="name" id="currentName">-</span>
      <span class="aliases" id="currentAliases"></span>
    </div>

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

  <div class="modal-overlay" id="formModalOverlay">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title" id="formModalTitle">${t("addPreset")}</span>
        <button class="modal-close" id="formModalClose">&times;</button>
      </div>
      <div class="modal-body">
        <form id="presetForm">
          <input type="hidden" id="editName" value="">
          <div class="form-group">
            <label class="form-label" for="presetNameInput">${t("presetName")}</label>
            <input type="text" class="form-input" id="presetNameInput" required pattern="^[a-zA-Z0-9-_]+$" placeholder="my-preset">
            <div class="form-hint">${t("presetNameHint")}</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="agentsInput">${t("agents")}</label>
            <textarea class="form-textarea" id="agentsInput" placeholder='{"Sisyphus": {"model": "claude-3-5-sonnet-20241002"}}'></textarea>
            <div class="form-hint">${t("agentsHint")}</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="categoriesInput">${t("categories")}</label>
            <textarea class="form-textarea" id="categoriesInput" placeholder='{"deep": "ultrabrain"}'></textarea>
            <div class="form-hint">${t("categoriesHint")}</div>
          </div>
          <div class="form-actions">
            <button type="button" class="form-btn form-btn-secondary" id="formCancelBtn">${t("cancel")}</button>
            <button type="submit" class="form-btn form-btn-primary">${t("save")}</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    const pageLang = "${lang}";
    const LANG = ${JSON.stringify(LANG)};
    const DEFAULT_ORDER = ${JSON.stringify(DEFAULT_ORDER)};
    const t = (key) => LANG[key] && LANG[key][pageLang] || LANG[key] && LANG[key].en || key;
    const $ = (s) => document.querySelector(s);
    let currentName = '';

    function toast(msg) {
      const t = $('#toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2000);
    }

    function renderCurrent(data) {
      const name = data.name ? t("currentLabel") + data.name : '-';
      const aliases = data.aliases && data.aliases.length ? ' (' + data.aliases.join(', ') + ')' : '';
      $('#currentName').textContent = name;
      $('#currentAliases').textContent = aliases;
      currentName = data.name || '';
    }

    async function load() {
      console.log('load() starting...');
      try {
        // 直接从 API 获取数据
        const res = await fetch('/api/presets');
        const presets = await res.json();
        const customRes = await fetch('/api/custom-presets');
        const custom = await customRes.json();
        const currentRes = await fetch('/api/current');
        const current = await currentRes.json();
        const orderRes = await fetch('/api/preset-order');
        let order = await orderRes.json();
        if (!order || !order.length) order = DEFAULT_ORDER;

        // 渲染当前配置
        renderCurrent(current);
        
        // 合并并排序预设
        const allPresets = [...presets, ...custom];
        allPresets.sort((a, b) => {
          const idxA = order.indexOf(a.name);
          const idxB = order.indexOf(b.name);
          if (idxA === -1 && idxB === -1) return a.name.localeCompare(b.name);
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
        
        // 渲染卡片
        const grid = $('#grid');
        console.log('Rendering', allPresets.length, 'presets');
        grid.innerHTML = allPresets.map(p => renderPresetCard(p)).join('');
        console.log('Grid updated');
        
        // 初始化拖拽
        initDragDrop();
        
        // 添加点击事件
        grid.querySelectorAll('.card.builtin').forEach(card => {
          card.addEventListener('click', (e) => {
            if (e.target.closest('.delete-btn') || e.target.closest('.edit-btn')) return;
            switchPreset(card.dataset.name);
          });
        });
      } catch (e) {
        console.error('Load error:', e);
        toast('加载失败: ' + e.message);
      }
    }

    function initDragDrop() {
      const grid = $('#grid');
      let dragSrcEl = null;

      grid.addEventListener('dragstart', (e) => {
        if (!e.target.classList.contains('card')) return;
        dragSrcEl = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      grid.addEventListener('dragend', (e) => {
        if (!e.target.classList.contains('card')) return;
        e.target.classList.remove('dragging');
      });

      grid.addEventListener('dragover', (e) => {
        if (e.preventDefault) e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        return false;
      });

      grid.addEventListener('drop', async (e) => {
        if (e.stopPropagation) e.stopPropagation();
        const target = e.target.closest('.card');
        if (!target || !dragSrcEl || target === dragSrcEl) return false;

        const cards = Array.from(grid.querySelectorAll('.card'));
        const fromIdx = cards.indexOf(dragSrcEl);
        const toIdx = cards.indexOf(target);
        if (fromIdx === -1 || toIdx === -1) return;

        // Reorder in DOM
        if (fromIdx < toIdx) {
          target.parentNode.insertBefore(dragSrcEl, target.nextSibling);
        } else {
          target.parentNode.insertBefore(dragSrcEl, target);
        }

        // Save new order
        const newOrder = Array.from(grid.querySelectorAll('.card')).map(c => c.dataset.name);
        try {
          await fetch('/api/preset-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: newOrder })
          });
        } catch (err) {
          console.error('Failed to save order:', err);
        }
        return false;
      });
    }

    function renderPresetCard(p) {
      const agents = Object.entries(p.agents || {}).slice(0, 4);
      const lines = agents.map(([role, v]) =>
        '<div class="card-agent"><span class="role">' + role + '</span><span>' + (v.model || v) + '</span></div>'
      ).join('');
      const aliases = p.aliases && p.aliases.length ? '(' + p.aliases.join(', ') + ')' : '';
      const isCustom = p.isCustom;
      const cls = (p.isCurrent ? 'card active' : 'card') + (isCustom ? ' custom' : ' builtin');
      let buttons = '';
      const isEditable = p.name !== 'default';
      if (isEditable && isCustom) {
        buttons = '<button class="delete-btn" title="' + t('delete') + '" onclick="event.stopPropagation(); deletePreset(\\'' + p.name + '\\')">&times;</button>' +
          '<button class="edit-btn" title="' + t('editPreset') + '" onclick="event.stopPropagation(); editPreset(\\'' + p.name + '\\',' + JSON.stringify(p.agents).replace(/'/g, "\\\\'") + ',' + JSON.stringify(p.categories || {}).replace(/'/g, "\\\\'") + ')">✎</button>';
      }
      return '<div class="' + cls + '" data-name="' + p.name + '" draggable="true">' +
        '<div class="card-header">' +
          '<span class="card-name">' + p.name + '</span>' +
          (aliases ? '<span class="card-aliases">' + aliases + '</span>' : '') +
        '</div>' +
        '<div class="card-agents">' + lines + '</div>' +
        buttons +
      '</div>';
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
        load();
        toast(t("switchDone"));
      } catch (e) {
        toast(t("failSwitch") + ": " + e.message);
      }
    }

    load();

    // Help modal
    $('#helpBtn').addEventListener('click', () => {
      $('#modalOverlay').classList.add('show');
    });
    $('#modalClose').addEventListener('click', () => {
      $('#modalOverlay').classList.remove('show');
    });
    $('#modalOverlay').addEventListener('click', (e) => {
      if (e.target === $('#modalOverlay')) $('#modalOverlay').classList.remove('show');
    });

    // Add/Edit preset modal
    const formModal = $('#formModalOverlay');
    const form = $('#presetForm');
    const editNameInput = $('#editName');
    const nameInput = $('#presetNameInput');
    const agentsInput = $('#agentsInput');
    const categoriesInput = $('#categoriesInput');

    $('#addPresetBtn').addEventListener('click', () => {
      editNameInput.value = '';
      $('#formModalTitle').textContent = t('addPreset');
      nameInput.value = '';
      nameInput.disabled = false;
      agentsInput.value = '';
      categoriesInput.value = '';
      formModal.classList.add('show');
    });

    $('#formModalClose').addEventListener('click', () => {
      formModal.classList.remove('show');
    });
    $('#formCancelBtn').addEventListener('click', () => {
      formModal.classList.remove('show');
    });
    formModal.addEventListener('click', (e) => {
      if (e.target === formModal) formModal.classList.remove('show');
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      const isEdit = !!editNameInput.value;
      
      let agents, categories;
      try {
        agents = JSON.parse(agentsInput.value);
      } catch {
        toast(t('invalidJson') + ' (agents)');
        return;
      }
      try {
        categories = categoriesInput.value.trim() ? JSON.parse(categoriesInput.value) : {};
      } catch {
        toast(t('invalidJson') + ' (categories)');
        return;
      }

      try {
        let url = '/api/custom-presets';
        let method = 'POST';
        if (isEdit) {
          url = '/api/custom-presets/' + encodeURIComponent(editNameInput.value);
          method = 'PUT';
        }
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, agents, categories })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save');
        toast(t('saveSuccess'));
        formModal.classList.remove('show');
        load();
      } catch (e) {
        toast(e.message);
      }
    });

    window.editPreset = function(name, agents, categories) {
      editNameInput.value = name;
      $('#formModalTitle').textContent = t('editPreset');
      nameInput.value = name;
      nameInput.disabled = true;
      // 清空所有 input fields
      document.querySelectorAll('[data-agent]').forEach(i => i.value = '');
      document.querySelectorAll('[data-cat]').forEach(i => i.value = '');
      // 填充 agents
      if (agents) {
        Object.entries(agents).forEach(([key, val]) => {
          const input = document.querySelector('[data-agent="' + key + '"]');
          if (input) input.value = val.model || '';
        });
      }
      // 填充 categories
      if (categories) {
        Object.entries(categories).forEach(([key, val]) => {
          const input = document.querySelector('[data-cat="' + key + '"]');
          if (input) input.value = val.model || '';
        });
      }
      formModal.classList.add('show');
    };

    window.deletePreset = async function(name) {
      if (!confirm(t('deleteConfirm'))) return;
      try {
        const res = await fetch('/api/custom-presets/' + encodeURIComponent(name), { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        toast(t('deleteSuccess'));
        load();
      } catch (e) {
        toast(e.message);
      }
    };
  </script>
</body>
</html>`;
}

// ── Server ────────────────────────────────────────────────────────────────────
function handle(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
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

  // GET /api/custom-presets
  if (req.method === "GET" && url.pathname === "/api/custom-presets") {
    const custom = getCustomPresets();
    const currentName = getCurrentName();
    const result = custom.map(p => ({
      name: p.name,
      isCustom: true,
      isCurrent: p.name === currentName,
      agents: p.agents || {},
      categories: p.categories || {}
    }));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
    return;
  }

  // POST /api/custom-presets (create)
  if (req.method === "POST" && url.pathname === "/api/custom-presets") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { name, agents, categories } = JSON.parse(body);
        if (!name || !agents) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "name and agents are required" }));
          return;
        }
        if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid name: only letters, numbers, - and _ allowed" }));
          return;
        }
        if (isCustomPreset(name)) {
          res.writeHead(409, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Preset already exists" }));
          return;
        }
        saveCustomPreset(name, { agents, categories: categories || {} });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, name }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // PUT /api/custom-presets/:name (update)
  if (req.method === "PUT" && url.pathname.startsWith("/api/custom-presets/")) {
    const name = decodeURIComponent(url.pathname.replace("/api/custom-presets/", ""));
    if (!isCustomPreset(name)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Preset not found" }));
      return;
    }
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { agents, categories } = JSON.parse(body);
        if (!agents) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "agents is required" }));
          return;
        }
        saveCustomPreset(name, { agents, categories: categories || {} });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, name }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // DELETE /api/custom-presets/:name
  if (req.method === "DELETE" && url.pathname.startsWith("/api/custom-presets/")) {
    const name = decodeURIComponent(url.pathname.replace("/api/custom-presets/", ""));
    if (!isCustomPreset(name)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Preset not found" }));
      return;
    }
    deleteCustomPreset(name);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // GET /api/preset-order
  if (req.method === "GET" && url.pathname === "/api/preset-order") {
    const order = readOrder();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(order || DEFAULT_ORDER));
    return;
  }

  // POST /api/preset-order
  if (req.method === "POST" && url.pathname === "/api/preset-order") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { order } = JSON.parse(body);
        if (!Array.isArray(order)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "order must be an array" }));
          return;
        }
        saveOrder(order);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
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
