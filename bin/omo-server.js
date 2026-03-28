#!/usr/bin/env node
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const readline = require("readline");
const { execSync } = require("child_process");

const PRESET_DIR = path.join(__dirname, "..", "lib", "presets");
const HELP_FILE = path.join(__dirname, "..", "lib", "help.json");
const ICON_FILE = path.join(__dirname, "..", "favicon.ico");
const CONFIG_DIR = path.join(os.homedir(), ".config", "opencode");
const LIVE_FILE = path.join(CONFIG_DIR, "oh-my-opencode.jsonc");
const ROLE_FILE = path.join(CONFIG_DIR, "oh-my-opencode-role.json");
const ROLE_NAME_FILE = path.join(CONFIG_DIR, "oh-my-opencode-role-name.json");
const CUSTOM_DIR = path.join(CONFIG_DIR, "omo-custom-presets");
const ORDER_FILE = path.join(CONFIG_DIR, "omo-preset-order.json");
const ALIAS_FILE = path.join(PRESET_DIR, "aliases.json");
const DEFAULT_ORDER = ["default", "mimo", "gpt-mini", "gpt", "code"];
const DEFAULT_PORT = 9527;
const HOST = process.env.HOST || "0.0.0.0";
const FIELD_TIPS = {
  agents: {
    sisyphus: { zh: "默认主力编码代理，偏稳定执行。", en: "Primary coding agent for steady execution." },
    hephaestus: { zh: "偏实现与构建，适合产出代码。", en: "Implementation-focused agent for code output." },
    oracle: { zh: "偏分析与判断，适合高层建议。", en: "Analysis-oriented agent for higher-level judgment." },
    librarian: { zh: "偏检索与整理上下文。", en: "Good at lookup and organizing context." },
    explore: { zh: "偏探索式排查与快速试错。", en: "Useful for exploratory debugging and iteration." },
    "multimodal-looker": { zh: "偏视觉/多模态理解。", en: "Handles visual and multimodal tasks." },
    prometheus: { zh: "偏规划和推进复杂任务。", en: "Helpful for planning and driving complex tasks." },
    metis: { zh: "偏策略判断与问题拆解。", en: "Good for strategy and decomposition." },
    momus: { zh: "偏创意表达与内容润色。", en: "Useful for creative phrasing and polish." },
    atlas: { zh: "偏全局统筹与复杂上下文。", en: "Useful for broad context and coordination." }
  },
  categories: {
    "visual-engineering": { zh: "视觉工程相关任务。", en: "Tasks focused on visual engineering." },
    ultrabrain: { zh: "高强度思考与复杂推理。", en: "Heavy thinking and complex reasoning." },
    deep: { zh: "深入分析类任务。", en: "Deep analysis tasks." },
    artistry: { zh: "创意、文案和表达。", en: "Creative writing and expressive work." },
    quick: { zh: "快速响应的小任务。", en: "Quick-turnaround tasks." },
    "unspecified-low": { zh: "低强度通用任务。", en: "Lower-intensity general tasks." },
    "unspecified-high": { zh: "高强度通用任务。", en: "Higher-intensity general tasks." },
    writing: { zh: "写作与说明类任务。", en: "Writing and explanatory tasks." }
  }
};

if (!fs.existsSync(CUSTOM_DIR)) fs.mkdirSync(CUSTOM_DIR, { recursive: true });

const HELP_DATA = readJSONSafe(HELP_FILE) || {};
const TEXT = {
  zh: { addPreset: "添加配置", editPreset: "编辑配置", presetName: "配置名称", presetNameHint: "只允许字母、数字、下划线、连字符", presetNote: "备注（可选）", presetNoteHint: "给这个配置添加备注", presetAliases: "别名（可选）", presetAliasesHint: "逗号分隔，如: my, test", agents: "Agents", agentsHint: "使用 individual input fields", categories: "Categories", categoriesHint: "可选分类字段", save: "保存", cancel: "取消", delete: "删除", deleteConfirm: "确定删除此预设？", saveSuccess: "保存成功", deleteSuccess: "已删除", nameRequired: "请输入配置名称", agentsRequired: "请至少填写一个 agent", invalidName: "名称只能包含字母、数字、- 和 _", current: "当前", preset: "预设", currentLabel: "当前：", loading: "加载中...", switchDone: "切换成功", failLoad: "加载失败", failSwitch: "切换失败", poweredBy: "Powered by", helpTitle: "帮助", custom: "自定义", override: "覆盖", builtin: "内置", shutdown: "关闭服务器", shutdownConfirm: "确定关闭服务器？", shutdownDone: "服务器已关闭", portInUse: "端口 :port 已被占用", portDenied: "端口 :port 权限不足", enterNewPort: "请输入新端口号（直接回车退出）: ", invalidPort: "无效端口号，请输入 1024-65535 之间的数字", tryingPort: "尝试启动 :port ..." },
  en: { addPreset: "Add Preset", editPreset: "Edit Preset", presetName: "Preset Name", presetNameHint: "Letters, numbers, - and _ only", presetNote: "Note (Optional)", presetNoteHint: "Add a note for this preset", presetAliases: "Aliases (Optional)", presetAliasesHint: "Comma separated, e.g.: my, test", agents: "Agents", agentsHint: "Use individual input fields", categories: "Categories", categoriesHint: "Optional category fields", save: "Save", cancel: "Cancel", delete: "Delete", deleteConfirm: "Delete this preset?", saveSuccess: "Saved", deleteSuccess: "Deleted", nameRequired: "Name is required", agentsRequired: "At least one agent is required", invalidName: "Only letters, numbers, - and _ are allowed", current: "Current", preset: "Preset", currentLabel: "Current: ", loading: "Loading...", switchDone: "Switched", failLoad: "Load failed", failSwitch: "Switch failed", poweredBy: "Powered by", helpTitle: "Help", custom: "Custom", override: "Override", builtin: "Builtin", shutdown: "Shutdown", shutdownConfirm: "Shutdown server?", shutdownDone: "Server closed", portInUse: "Port :port in use", portDenied: "Port :port access denied", enterNewPort: "Enter new port (press Enter to exit): ", invalidPort: "Invalid port, please enter a number between 1024-65535", tryingPort: "Trying port :port ..." }
};

function promptNewPort(currentPort, errorCode) {
  const message = errorCode === "EADDRINUSE" ? t("portInUse") : t("portDenied");
  console.error(`\n  ${message.replace(":port", currentPort)}`);
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr
  });
  
  rl.question(t("enterNewPort"), (answer) => {
    rl.close();
    const newPort = parseInt(answer.trim(), 10);
    
    if (!answer.trim()) {
      console.log("\n  已退出 / Exited\n");
      process.exit(0);
    }
    
    if (isNaN(newPort) || newPort < 1024 || newPort > 65535) {
      console.error(`  ${t("invalidPort")}`);
      promptNewPort(currentPort, errorCode);
      return;
    }
    
    port = newPort;
    console.log(`  ${t("tryingPort").replace(":port", port)}`);
    server.listen(port, HOST);
  });
}

function readJSONSafe(file) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; } }
function writeJSON(file, data) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8"); }
function isObject(v) { return v && typeof v === "object" && !Array.isArray(v); }
function normalizeAliases(v) { if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean); if (typeof v === "string") return v.split(",").map((x) => x.trim()).filter(Boolean); return []; }
function escapeHTML(v) { return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
function builtinPath(name) { return path.join(PRESET_DIR, `${name}.json`); }
function customPath(name) { return path.join(CUSTOM_DIR, `${name}.json`); }
function builtinExists(name) { return fs.existsSync(builtinPath(name)); }
function customExists(name) { return fs.existsSync(customPath(name)); }
function isDeletedPreset(data) { return isObject(data) && data._omo_deleted === true; }

function sanitizePresetData(data) {
  const clone = isObject(data) ? JSON.parse(JSON.stringify(data)) : {};
  delete clone._omo_deleted; delete clone._omo_deletedAt; delete clone._omo_kind; delete clone._omo_source;
  clone.agents = isObject(clone.agents) ? clone.agents : {};
  clone.categories = isObject(clone.categories) ? clone.categories : {};
  const aliases = normalizeAliases(clone.aliases); if (aliases.length) clone.aliases = aliases; else delete clone.aliases;
  if (typeof clone.note === "string") { clone.note = clone.note.trim(); if (!clone.note) delete clone.note; } else delete clone.note;
  return clone;
}

function getBuiltinNames() { return fs.readdirSync(PRESET_DIR).filter((f) => f.endsWith(".json") && f !== "aliases.json").map((f) => path.basename(f, ".json")).sort((a, b) => a.localeCompare(b)); }
function getCustomNames() { return fs.readdirSync(CUSTOM_DIR).filter((f) => f.endsWith(".json")).map((f) => path.basename(f, ".json")).sort((a, b) => a.localeCompare(b)); }
function getVisibleNames() { return [...new Set([...getBuiltinNames(), ...getCustomNames()])]; }
function getBuiltinAliases(name) { return normalizeAliases((readJSONSafe(ALIAS_FILE) || {})[name]); }

function getPresetRecord(name) {
  if (customExists(name)) {
    const raw = readJSONSafe(customPath(name)); if (!raw) return null;
    if (isDeletedPreset(raw)) return { name, kind: "deleted", data: raw, aliases: [], note: "", agents: {}, categories: {} };
    const data = sanitizePresetData(raw);
    return { name, kind: builtinExists(name) ? "override" : "custom", data, aliases: data.aliases || [], note: data.note || "", agents: data.agents || {}, categories: data.categories || {} };
  }
  if (!builtinExists(name)) return null;
  const data = sanitizePresetData(readJSONSafe(builtinPath(name)));
  return { name, kind: "builtin", data, aliases: getBuiltinAliases(name), note: data.note || "", agents: data.agents || {}, categories: data.categories || {} };
}

function getPresetAliases(name, record) { return record?.aliases?.length ? record.aliases : getBuiltinAliases(name); }
function getCurrentName() { const role = readJSONSafe(ROLE_NAME_FILE); return role && role.role ? role.role : null; }
function getCurrentConfig() { const name = getCurrentName(); const record = name ? getPresetRecord(name) : null; return { name, aliases: record ? getPresetAliases(name, record) : [], config: record && record.kind !== "deleted" ? record.data : readJSONSafe(LIVE_FILE) }; }
function activatePreset(name) { const record = getPresetRecord(name); if (!record || record.kind === "deleted") return false; const data = sanitizePresetData(record.data); writeJSON(LIVE_FILE, data); writeJSON(ROLE_FILE, data); writeJSON(ROLE_NAME_FILE, { role: name }); return true; }

function resolveName(input) {
  const direct = getPresetRecord(input); if (direct && direct.kind !== "deleted") return input;
  for (const [name, aliases] of Object.entries(readJSONSafe(ALIAS_FILE) || {})) if (normalizeAliases(aliases).includes(input) && getPresetRecord(name)?.kind !== "deleted") return name;
  for (const name of getVisibleNames()) { const record = getPresetRecord(name); if (record && record.kind !== "deleted" && getPresetAliases(name, record).includes(input)) return name; }
  return null;
}

function normalizeOrder(order) { const seen = new Set(); const out = []; for (const name of Array.isArray(order) ? order : []) { if (typeof name !== "string" || seen.has(name)) continue; seen.add(name); out.push(name); } return out; }
function readOrder() { try { return normalizeOrder(JSON.parse(fs.readFileSync(ORDER_FILE, "utf8"))); } catch { return []; } }
function saveOrder(order) { writeJSON(ORDER_FILE, normalizeOrder(order)); }
function sortPresets(presets, order = readOrder()) { const map = new Map(order.map((n, i) => [n, i])); const fallback = Number.MAX_SAFE_INTEGER; return [...presets].sort((a, b) => { const ia = map.has(a.name) ? map.get(a.name) : fallback; const ib = map.has(b.name) ? map.get(b.name) : fallback; return ia !== ib ? ia - ib : a.name.localeCompare(b.name); }); }

function getPresetList() {
  const current = getCurrentName();
  return sortPresets(getVisibleNames().map((name) => {
    const record = getPresetRecord(name); if (!record || record.kind === "deleted") return null;
    return { name, kind: record.kind, isCustom: record.kind !== "builtin", isOverride: record.kind === "override", isCurrent: name === current, editable: name !== "default", deletable: name !== "default", aliases: getPresetAliases(name, record), note: record.note || "", agents: record.agents || {}, categories: record.categories || {} };
  }).filter(Boolean));
}
function getCustomPresetList() { return getPresetList().filter((p) => p.isCustom); }

function getPresetSchemaSource() {
  const d = getPresetRecord("default") || { agents: {}, categories: {} };
  const records = getPresetList();
  const da = Object.keys(d.agents || {}), dc = Object.keys(d.categories || {});
  const as = new Set(da), cs = new Set(dc);
  records.forEach((r) => { Object.keys(r.agents || {}).forEach((k) => as.add(k)); Object.keys(r.categories || {}).forEach((k) => cs.add(k)); });
  return { agents: [...da, ...[...as].filter((k) => !da.includes(k)).sort((a, b) => a.localeCompare(b))], categories: [...dc, ...[...cs].filter((k) => !dc.includes(k)).sort((a, b) => a.localeCompare(b))] };
}

function savePresetRecord(name, payload) { writeJSON(customPath(name), sanitizePresetData(payload)); }
function deletePresetRecord(name) { if (name === "default") return false; if (customExists(name)) { fs.unlinkSync(customPath(name)); return true; } return false; }
function ensureActivePresetAfterDelete(name) { if (getCurrentName() !== name) return; if (getPresetRecord("default") && getPresetRecord("default").kind !== "deleted") { activatePreset("default"); return; } try { fs.unlinkSync(LIVE_FILE); } catch {} try { fs.unlinkSync(ROLE_FILE); } catch {} try { fs.unlinkSync(ROLE_NAME_FILE); } catch {} }

const langArg = process.argv.slice(2).find((arg) => arg === "-e" || arg === "--en") ? "en" : "zh";
let port = (() => { const n = process.argv.slice(2).find((arg) => /^\d+$/.test(arg)); return n ? parseInt(n, 10) : DEFAULT_PORT; })();
const t = (key) => (TEXT[langArg] && TEXT[langArg][key]) || TEXT.en[key] || key;

function makeHTML(pageLang) {
  const currentLang = pageLang === "en" ? "en" : "zh";
  const schema = getPresetSchemaSource();
  return `<!doctype html><html lang="${currentLang === "en" ? "en" : "zh-CN"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OMO Config Switcher</title><link rel="icon" href="/favicon.ico"><style>
  *{box-sizing:border-box} body{margin:0;min-height:100vh;display:flex;flex-direction:column;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:radial-gradient(circle at top,#1f2937 0,#0f172a 36%,#020617 100%);color:#e2e8f0;scrollbar-width:thin;scrollbar-color:#475569 rgba(15,23,42,.85)}
  *::-webkit-scrollbar{width:10px;height:10px}
  *::-webkit-scrollbar-track{background:rgba(15,23,42,.78)}
  *::-webkit-scrollbar-thumb{background:linear-gradient(180deg,#475569,#334155);border-radius:999px;border:2px solid rgba(15,23,42,.9)}
  *::-webkit-scrollbar-thumb:hover{background:linear-gradient(180deg,#64748b,#475569)}
  *::-webkit-scrollbar-corner{background:rgba(15,23,42,.78)}
  .app{width:min(1120px,calc(100% - 2rem));margin:0 auto;padding:1.5rem 0 .75rem;flex:1;display:flex;flex-direction:column}
  .header{display:flex;justify-content:space-between;gap:1rem;align-items:center;margin-bottom:1rem}.subtitle{color:#94a3b8;margin:.25rem 0 0}.header-actions{display:flex;align-items:center;gap:1rem;flex-wrap:wrap}
  .add-btn{border:0;border-radius:999px;padding:.6rem 1rem;font-weight:700;cursor:pointer;background:linear-gradient(135deg,#38bdf8,#0ea5e9);color:#082f49}.lang-btn{display:flex;gap:.35rem;align-items:center}.lang-btn a{color:#94a3b8;text-decoration:none;font-size:.8rem;font-weight:600}.lang-btn a.active{color:#fff}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:1rem}.card{position:relative;min-height:240px;padding:1rem 1rem 4.1rem;border-radius:18px;background:rgba(15,23,42,.8);border:1px solid rgba(51,65,85,.95);cursor:pointer;transition:.18s}.card:hover{transform:translateY(-2px);border-color:#38bdf8}.card.active{border-color:#eab308;background:rgba(26,24,7,.9)}
  .card-top{display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start}.card-title{display:flex;flex-direction:column;gap:.45rem;min-width:0;flex:1}.card-name-row{display:flex;gap:.5rem;align-items:flex-start;justify-content:space-between}.card-name{font-size:1.05rem;font-weight:700;color:#fff;min-width:0;word-break:break-word}.badges{display:flex;gap:.35rem;flex-wrap:wrap;justify-content:flex-end;flex-shrink:0}.badge{display:inline-flex;align-items:center;border-radius:999px;padding:.2rem .55rem;font-size:.65rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.badge.current{background:#eab308;color:#111827}.badge.preset{background:#334155;color:#94a3b8}.badge.custom{background:#7c3aed;color:#fff}.badge.override{background:#0ea5e9;color:#fff}
  .card-meta{color:#94a3b8;font-size:.82rem;word-break:break-word}.card-list{display:grid;gap:.55rem}.card-section{display:grid;gap:.2rem}.card-section-title{color:#94a3b8;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em}.card-item{display:flex;gap:.5rem;color:#cbd5e1;font-size:.82rem}.card-item .key{min-width:95px;color:#38bdf8}
  .card-actions{position:absolute;right:.9rem;bottom:.9rem;display:flex;gap:.5rem;flex-wrap:wrap}.action-btn{border:1px solid rgba(71,85,105,.9);background:rgba(2,6,23,.65);color:#cbd5e1;border-radius:999px;padding:.36rem .72rem;font-size:.74rem;font-weight:700;cursor:pointer}.action-btn:hover{border-color:#38bdf8;color:#fff}.action-btn.delete:hover{border-color:#f87171;color:#fecaca}
  .footer{margin-top:auto;padding:1.3rem 0 .35rem;text-align:center;color:#94a3b8}.footer a{color:#e2e8f0;text-decoration:none}.footer a:hover{color:#fff}.shutdown-btn{background:none;border:none;color:#64748b;font-size:1.1rem;padding:.2rem .4rem;margin-left:.6rem;cursor:pointer;vertical-align:middle;transition:color .15s}.shutdown-btn:hover{color:#f87171}.confirm-overlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(1,4,12,.84);z-index:400}.confirm-overlay.show{display:flex}.confirm-box{background:#0f172a;border:1px solid rgba(51,65,85,.95);border-radius:14px;padding:1.5rem;max-width:360px;text-align:center}.confirm-msg{color:#e2e8f0;font-size:1rem;margin-bottom:1.2rem}.confirm-actions{display:flex;gap:.75rem;justify-content:center}.form-btn.danger{background:rgba(239,68,68,.15);border-color:rgba(239,68,68,.5);color:#fca5a5}.form-btn.danger:hover{background:rgba(239,68,68,.25);border-color:#f87171;color:#fff}
  .help-btn{position:fixed;right:1rem;bottom:1rem;width:2.6rem;height:2.6rem;border-radius:999px;border:1px solid rgba(51,65,85,.9);background:rgba(15,23,42,.95);color:#94a3b8;cursor:pointer}
  .modal-overlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(1,4,12,.84);z-index:200;padding:1rem}.modal-overlay.show{display:flex}.modal{width:min(760px,100%);max-height:min(90vh,860px);overflow:auto;overscroll-behavior:contain;border-radius:18px;background:#0f172a;border:1px solid rgba(51,65,85,.95)} body.modal-locked{overflow:hidden;position:fixed;left:0;right:0;width:100%}
  .modal-header{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.1rem;border-bottom:1px solid rgba(51,65,85,.85)}.modal-title{font-weight:800;color:#fff}.modal-close{border:0;background:transparent;color:#94a3b8;cursor:pointer;font-size:1.2rem}.modal-body{padding:1.1rem;overscroll-behavior:contain}.modal-body p{color:#cbd5e1;line-height:1.65;margin-bottom:.75rem}.modal-body a{color:#38bdf8}
  .form-group{margin-bottom:1rem;padding:0 .25rem}.form-label{display:block;margin-bottom:.4rem;color:#94a3b8;font-size:.74rem;text-transform:uppercase;letter-spacing:.08em;font-weight:700}.form-label-row{display:flex;align-items:center;gap:.35rem;margin-bottom:.4rem}.form-input,.form-textarea{width:100%;border:1px solid rgba(51,65,85,.95);background:rgba(2,6,23,.8);color:#e2e8f0;border-radius:10px;padding:.7rem .8rem;font:inherit}.form-textarea{min-height:94px;resize:vertical}.form-hint{color:#64748b;font-size:.75rem;margin-top:.35rem}.form-actions{display:flex;justify-content:flex-end;gap:.75rem;margin-top:1.2rem}.form-btn{border-radius:999px;padding:.55rem 1rem;border:1px solid rgba(51,65,85,.95);background:rgba(15,23,42,.9);color:#cbd5e1;font-weight:700;cursor:pointer}.form-btn.primary{background:linear-gradient(135deg,#38bdf8,#0ea5e9);color:#082f49;border-color:transparent}
  .input-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem;padding:0 .25rem}.field-row{display:grid;gap:.35rem}.field-label-row{display:flex;align-items:center;gap:.35rem}.field-label{color:#38bdf8;font-size:.82rem;word-break:break-word}.field-tip{color:#94a3b8;font-size:.72rem;font-style:italic;font-weight:400;margin-left:.6rem;text-transform:none;letter-spacing:0}.section-title{display:flex;align-items:center;gap:.5rem;padding:.6rem .8rem;margin-bottom:.6rem;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.2);border-radius:8px}.section-icon{font-size:.9rem;opacity:.8}.section-text{color:#38bdf8;font-size:.82rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em}.section-desc{color:#94a3b8;font-size:.7rem;font-style:italic;margin-left:auto}.field-input{width:100%;border:1px solid rgba(51,65,85,.95);background:rgba(2,6,23,.8);color:#e2e8f0;border-radius:10px;padding:.58rem .7rem;font:inherit}.empty-fields{color:#64748b;font-size:.84rem;padding:.6rem 0}
  @media(max-width:760px){.header{flex-direction:column;align-items:flex-start}.input-grid{grid-template-columns:1fr}.card{min-height:220px}.card-item .key{min-width:82px}}
  </style></head><body><div class="app">
  <div class="header"><div class="header-left"><h1>OMO Config Switcher<button class="shutdown-btn" id="shutdownBtn" type="button" title="${escapeHTML(TEXT[currentLang].shutdown)}">⏻</button></h1><div class="subtitle">${escapeHTML((HELP_DATA.subtitle && (HELP_DATA.subtitle[currentLang] || HELP_DATA.subtitle.en)) || "OpenCode oh-my-opencode preset manager")}</div></div><div class="header-actions"><button class="add-btn" id="addPresetBtn" type="button">+ ${escapeHTML(TEXT[currentLang].addPreset)}</button><div class="lang-btn"><a href="?lang=en" ${currentLang === "en" ? 'class="active"' : ""}>EN</a><span>/</span><a href="?lang=zh" ${currentLang === "zh" ? 'class="active"' : ""}>中文</a></div></div></div>
  <div class="grid" id="grid"><div class="loading">${escapeHTML(TEXT[currentLang].loading)}</div></div>
  <footer class="footer">${escapeHTML(TEXT[currentLang].poweredBy)} <a href="https://github.com/ez-coder-admin/ezcoder-omo-config" target="_blank" rel="noreferrer">ezcoder-omo-config</a></footer>
  </div>
  <button class="help-btn" id="helpBtn" type="button">?</button>
  <div class="modal-overlay" id="helpModal"><div class="modal"><div class="modal-header"><div class="modal-title">${escapeHTML(TEXT[currentLang].helpTitle)}</div><button class="modal-close" id="helpClose" type="button">&times;</button></div><div class="modal-body"><p>${escapeHTML(currentLang === "en" ? "Click a card to switch preset. Use the buttons to edit or delete." : "点击卡片切换预设。使用按钮编辑或删除。")}</p><p>${escapeHTML((HELP_DATA.helpPage && (HELP_DATA.helpPage[currentLang === "en" ? "note_en" : "note_zh"])) || "")}</p></div></div></div>
  <div class="modal-overlay" id="formModal"><div class="modal"><div class="modal-header"><div class="modal-title" id="formTitle">${escapeHTML(TEXT[currentLang].addPreset)}</div><button class="modal-close" id="formClose" type="button">&times;</button></div><div class="modal-body"><form id="presetForm"><input type="hidden" id="editName" value=""><div class="form-group"><label class="form-label" for="presetNameInput">${escapeHTML(TEXT[currentLang].presetName)}</label><input class="form-input" id="presetNameInput" type="text" required pattern="^[a-zA-Z0-9-_]+$" placeholder="my-preset"><div class="form-hint">${escapeHTML(TEXT[currentLang].presetNameHint)}</div></div><div class="form-group"><label class="form-label" for="presetNoteInput">${escapeHTML(TEXT[currentLang].presetNote)}</label><textarea class="form-textarea" id="presetNoteInput" placeholder="${currentLang === "en" ? "Optional note" : "可选备注"}"></textarea><div class="form-hint">${escapeHTML(TEXT[currentLang].presetNoteHint)}</div></div><div class="form-group"><label class="form-label" for="presetAliasesInput">${escapeHTML(TEXT[currentLang].presetAliases)}</label><input class="form-input" id="presetAliasesInput" type="text" placeholder="my, test"><div class="form-hint">${escapeHTML(TEXT[currentLang].presetAliasesHint)}</div></div><div class="form-group"><div class="section-title"><span class="section-icon">⚙</span><span class="section-text">${escapeHTML(TEXT[currentLang].agents)}</span><span class="section-desc">${escapeHTML(currentLang === "en" ? "Map each role to its model" : "给每个角色指定模型")}</span></div><div class="input-grid" id="agentFields"></div></div><div class="form-group"><div class="section-title"><span class="section-icon">📋</span><span class="section-text">${escapeHTML(TEXT[currentLang].categories)}</span><span class="section-desc">${escapeHTML(currentLang === "en" ? "Optional task categories" : "可选的任务分类")}</span></div><div class="input-grid" id="categoryFields"></div></div><div class="form-actions"><button class="form-btn" type="button" id="formCancelBtn">${escapeHTML(TEXT[currentLang].cancel)}</button><button class="form-btn primary" type="submit">${escapeHTML(TEXT[currentLang].save)}</button></div></form></div></div></div>
  <div id="toast" style="position:fixed;left:50%;top:4.5rem;transform:translateX(-50%) translateY(-12px);background:#0f172a;border:1px solid #38bdf8;color:#e2e8f0;padding:.75rem 1rem;border-radius:999px;opacity:0;pointer-events:none;transition:all .2s ease;z-index:300;max-width:min(92vw,720px);text-align:center;box-shadow:0 12px 28px rgba(2,6,23,.35);"></div>
  <div class="confirm-overlay" id="confirmOverlay"><div class="confirm-box"><div class="confirm-msg" id="confirmMsg"></div><div class="confirm-actions"><button class="form-btn" id="confirmCancel" type="button">${escapeHTML(TEXT[currentLang].cancel)}</button><button class="form-btn danger" id="confirmOk" type="button">${escapeHTML(TEXT[currentLang].delete)}</button></div></div></div>
  <script>
    const pageLang=${JSON.stringify(currentLang)},TEXT=${JSON.stringify(TEXT)},DEFAULT_ORDER=${JSON.stringify(DEFAULT_ORDER)},INITIAL_SCHEMA=${JSON.stringify(schema)},FIELD_TIPS=${JSON.stringify(FIELD_TIPS)};
    const presetMap=new Map(); let currentSchema=INITIAL_SCHEMA,currentName="";
    const $=(s)=>s&&s.nodeType===1?s:document.querySelector(s), t=(k)=>(TEXT[pageLang]&&TEXT[pageLang][k])||TEXT.en[k]||k, esc=(v)=>String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
    let modalLockCount=0; let lockedScrollY=0;
    function lockBodyScroll(){ if(modalLockCount===0){ lockedScrollY=window.scrollY||window.pageYOffset||0; document.body.classList.add("modal-locked"); document.body.style.top='-'+lockedScrollY+'px'; } modalLockCount+=1; }
    function unlockBodyScroll(){ if(modalLockCount<=0) return; modalLockCount-=1; if(modalLockCount===0){ document.body.classList.remove("modal-locked"); document.body.style.top=""; window.scrollTo(0, lockedScrollY); } }
    function openModal(id){ const el=$(id); if(!el) return; lockBodyScroll(); el.classList.add("show"); }
    function closeModal(id){ const el=$(id); if(!el) return; el.classList.remove("show"); unlockBodyScroll(); }
    function attachModalScrollGuard(id){ const overlay=$(id); if(!overlay || overlay.dataset.scrollGuard==="1") return; overlay.dataset.scrollGuard="1"; const modal=overlay.querySelector(".modal"); if(!modal) return; const shouldTrap=(target,delta)=>{ const body=target.querySelector(".modal-body"); const scrollEl=body && body.scrollHeight>body.clientHeight ? body : target; if(!scrollEl) return false; const atTop=scrollEl.scrollTop<=0; const atBottom=scrollEl.scrollTop+scrollEl.clientHeight>=scrollEl.scrollHeight-1; return (delta<0&&atTop) || (delta>0&&atBottom); }; modal.addEventListener("wheel",(e)=>{ if(shouldTrap(modal,e.deltaY)) e.preventDefault(); },{passive:false}); modal.addEventListener("touchmove",(e)=>{ if(shouldTrap(modal,0)) e.preventDefault(); },{passive:false}); }
    function toast(msg,err){const el=$("#toast"); el.textContent=msg; el.style.borderColor=err?"#f87171":"#38bdf8"; el.style.color=err?"#fecaca":"#e2e8f0"; el.style.opacity="1"; el.style.transform="translateX(-50%) translateY(0)"; clearTimeout(toast._t); toast._t=setTimeout(()=>{el.style.opacity="0";el.style.transform="translateX(-50%) translateY(-12px)"},1800);}
    const valueText=(v)=>v&&typeof v==="object"?(v.model||""):(v||"");
    const buildSchema=(presets)=>{const d=presets.find((p)=>p.name==="default")||{agents:{},categories:{}}; const da=Object.keys(d.agents||{}), dc=Object.keys(d.categories||{}); const as=new Set(da), cs=new Set(dc); presets.forEach((p)=>{Object.keys(p.agents||{}).forEach((k)=>as.add(k)); Object.keys(p.categories||{}).forEach((k)=>cs.add(k));}); return {agents:[...da,...[...as].filter((k)=>!da.includes(k)).sort((a,b)=>a.localeCompare(b))],categories:[...dc,...[...cs].filter((k)=>!dc.includes(k)).sort((a,b)=>a.localeCompare(b))]};};
    function fieldHelp(type,key){ const tip=FIELD_TIPS[type]&&FIELD_TIPS[type][key]&&(FIELD_TIPS[type][key][pageLang]||FIELD_TIPS[type][key].en); return tip?'<span class="field-tip">'+esc(tip)+'</span>':''; }
    function renderFieldGrid(){ $("#agentFields").innerHTML=currentSchema.agents.length?currentSchema.agents.map((k)=>'<div class="field-row"><div class="field-label-row"><label class="field-label" for="agent-'+esc(k)+'">'+esc(k)+'</label>'+fieldHelp("agents",k)+'</div><input class="field-input" id="agent-'+esc(k)+'" data-agent="'+esc(k)+'" type="text" placeholder="model"></div>').join(''):'<div class="empty-fields">-</div>'; $("#categoryFields").innerHTML=currentSchema.categories.length?currentSchema.categories.map((k)=>'<div class="field-row"><div class="field-label-row"><label class="field-label" for="cat-'+esc(k)+'">'+esc(k)+'</label>'+fieldHelp("categories",k)+'</div><input class="field-input" id="cat-'+esc(k)+'" data-cat="'+esc(k)+'" type="text" placeholder="model"></div>').join(''):'<div class="empty-fields">-</div>'; }
    function fillForm(p){ $("#presetNameInput").value=p?.name||""; $("#presetNameInput").disabled=!!p?.name; $("#presetNoteInput").value=p?.note||""; $("#presetAliasesInput").value=Array.isArray(p?.aliases)?p.aliases.join(", "):""; document.querySelectorAll("[data-agent]").forEach((i)=>i.value=valueText(p?.agents?.[i.dataset.agent])); document.querySelectorAll("[data-cat]").forEach((i)=>i.value=valueText(p?.categories?.[i.dataset.cat])); }
    function openForm(p){ const edit=!!p?.name; $("#formTitle").textContent=edit?t("editPreset"):t("addPreset"); $("#editName").value=edit?p.name:""; renderFieldGrid(); fillForm(p); openModal("#formModal"); }
    function collectPayload(){ const agents={},categories={}; document.querySelectorAll("[data-agent]").forEach((i)=>{const v=i.value.trim(); if(v) agents[i.dataset.agent]={model:v};}); document.querySelectorAll("[data-cat]").forEach((i)=>{const v=i.value.trim(); if(v) categories[i.dataset.cat]={model:v};}); return {agents,categories,aliases:$("#presetAliasesInput").value.split(",").map((x)=>x.trim()).filter(Boolean),note:$("#presetNoteInput").value.trim()}; }
    function renderCurrent(d){ currentName=d?.name||""; }
    function renderCard(p){ const agents=Object.entries(p.agents||{}).slice(0,4).map(([k,v])=>'<div class="card-item"><span class="key">'+esc(k)+'</span><span>'+esc(valueText(v))+'</span></div>').join(""), categories=Object.entries(p.categories||{}).slice(0,3).map(([k,v])=>'<div class="card-item"><span class="key">'+esc(k)+'</span><span>'+esc(valueText(v))+'</span></div>').join(""), badges=[p.isCurrent?'<span class="badge current">'+esc(t("current"))+'</span>':"",p.kind==="builtin"?'<span class="badge preset">'+esc(t("preset"))+'</span>':"",p.kind==="custom"?'<span class="badge custom">'+esc(t("custom"))+'</span>':"",p.kind==="override"?'<span class="badge override">'+esc(t("override"))+'</span>':""].join(""), aliases=Array.isArray(p.aliases)&&p.aliases.length?'<div class="card-meta">('+esc(p.aliases.join(", "))+')</div>':"", note=p.note?'<div class="card-meta">'+esc(p.note)+'</div>':"", actions=p.name==="default"?"":'<div class="card-actions"><button class="action-btn" type="button" data-action="edit" data-name="'+esc(p.name)+'">'+esc(t("editPreset"))+'</button><button class="action-btn delete" type="button" data-action="delete" data-name="'+esc(p.name)+'">'+esc(t("delete"))+'</button></div>'; return '<div class="card '+(p.isCurrent?"active":"")+'" data-name="'+esc(p.name)+'" draggable="true"><div class="card-top"><div class="card-title"><div class="card-name-row"><span class="card-name">'+esc(p.name)+'</span><div class="badges">'+badges+'</div></div>'+aliases+note+'</div></div><div class="card-list">'+(agents?'<div class="card-section"><div class="card-section-title">Agents</div>'+agents+'</div>':'')+(categories?'<div class="card-section"><div class="card-section-title">Categories</div>'+categories+'</div>':'')+'</div>'+actions+'</div>'; }
    function bindGrid(){ const grid=$("#grid"); if(grid.dataset.bound==="1") return; grid.dataset.bound="1"; let drag=null; grid.addEventListener("click",async(e)=>{const btn=e.target.closest("[data-action]"); if(btn){e.preventDefault(); e.stopPropagation(); const n=btn.dataset.name; if(btn.dataset.action==="edit") openForm(presetMap.get(n)||{name:n,agents:{},categories:{},aliases:[],note:""}); else await delPreset(n); return;} const card=e.target.closest(".card"); if(card) await switchPreset(card.dataset.name);}); grid.addEventListener("dragstart",(e)=>{const card=e.target.closest(".card"); if(!card||e.target.closest(".card-actions")) return; drag=card; card.classList.add("dragging"); e.dataTransfer.effectAllowed="move";}); grid.addEventListener("dragend",(e)=>{const card=e.target.closest(".card"); if(card) card.classList.remove("dragging"); drag=null;}); grid.addEventListener("dragover",(e)=>{e.preventDefault(); e.dataTransfer.dropEffect="move";}); grid.addEventListener("drop",async(e)=>{e.preventDefault(); const target=e.target.closest(".card"); if(!target||!drag||target===drag) return; const cards=[...grid.querySelectorAll(".card")], fi=cards.indexOf(drag), ti=cards.indexOf(target); if(fi<0||ti<0) return; if(fi<ti) target.parentNode.insertBefore(drag,target.nextSibling); else target.parentNode.insertBefore(drag,target); const order=[...grid.querySelectorAll(".card")].map((c)=>c.dataset.name); try{await fetch("/api/preset-order",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({order})});}catch{}}); }
    async function switchPreset(name){ if(name===currentName) return; try{const res=await fetch("/api/switch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})}); const data=await res.json().catch(()=>({})); if(!res.ok) throw new Error(data.error||t("failSwitch")); toast(t("switchDone")); await load();}catch(err){toast(t("failSwitch")+": "+err.message,true);} }
    async function delPreset(name){ if(!await showConfirm(t("deleteConfirm"))) return; try{const res=await fetch("/api/custom-presets/"+encodeURIComponent(name),{method:"DELETE"}); const data=await res.json().catch(()=>({})); if(!res.ok) throw new Error(data.error||t("deleteSuccess")); toast(t("deleteSuccess")); await load();}catch(err){toast(err.message||t("failLoad"),true);} }
    async function load(){ try{const [pr,cr,or]=await Promise.all([fetch("/api/presets"),fetch("/api/current"),fetch("/api/preset-order")]); const presets=await pr.json(), current=await cr.json(); let order=await or.json().catch(()=>[]); if(!Array.isArray(order)||!order.length) order=DEFAULT_ORDER; currentSchema=buildSchema(presets); renderFieldGrid(); renderCurrent(current); const sorted=presets.slice().sort((a,b)=>{const ia=order.indexOf(a.name), ib=order.indexOf(b.name); if(ia===-1&&ib===-1) return a.name.localeCompare(b.name); if(ia===-1) return 1; if(ib===-1) return -1; return ia-ib;}); presetMap.clear(); sorted.forEach((p)=>presetMap.set(p.name,p)); $("#grid").innerHTML=sorted.map(renderCard).join(""); bindGrid(); }catch(err){toast(err.message||t("failLoad"),true);} }
    $("#addPresetBtn").addEventListener("click",()=>openForm({name:"",agents:{},categories:{},aliases:[],note:""})); $("#helpBtn").addEventListener("click",()=>openModal("#helpModal")); $("#helpClose").addEventListener("click",()=>closeModal("#helpModal")); $("#helpModal").addEventListener("click",(e)=>{if(e.target===$("#helpModal")) closeModal("#helpModal");});
    const formModal=$("#formModal"), form=$("#presetForm"), editName=$("#editName"), nameInput=$("#presetNameInput"); $("#formClose").addEventListener("click",()=>closeModal("#formModal")); $("#formCancelBtn").addEventListener("click",()=>closeModal("#formModal")); formModal.addEventListener("click",(e)=>{if(e.target===formModal) closeModal("#formModal");});
    form.addEventListener("submit",async(e)=>{e.preventDefault(); const name=nameInput.value.trim(), isEdit=!!editName.value; if(!name){toast(t("nameRequired"),true); return;} if(!/^[a-zA-Z0-9-_]+$/.test(name)){toast(t("invalidName"),true); return;} const payload=collectPayload(); if(!Object.keys(payload.agents).length){toast(t("agentsRequired"),true); return;} try{const res=await fetch(isEdit?"/api/custom-presets/"+encodeURIComponent(editName.value):"/api/custom-presets",{method:isEdit?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,...payload})}); const data=await res.json().catch(()=>({})); if(!res.ok) throw new Error(data.error||t("failLoad")); toast(t("saveSuccess")); closeModal("#formModal"); await load();}catch(err){toast(err.message||t("failLoad"),true);} });
    function showConfirm(msg,okText){return new Promise((resolve)=>{const overlay=$("#confirmOverlay"); $("#confirmMsg").textContent=msg; $("#confirmOk").textContent=okText||t("delete"); overlay.classList.add("show"); const close=(v)=>{overlay.classList.remove("show"); resolve(v);}; $("#confirmCancel").onclick=()=>close(false); $("#confirmOk").onclick=()=>close(true); });}
    $("#shutdownBtn").addEventListener("click",async()=>{if(!await showConfirm(t("shutdownConfirm"),t("shutdown"))) return; try{await fetch("/api/shutdown",{method:"POST"}); toast(t("shutdownDone")); setTimeout(()=>window.close(),1000);}catch{toast("Error",true);} });
    [$("#helpModal"),$("#formModal")].forEach(attachModalScrollGuard); window.editPreset=(name)=>openForm(presetMap.get(name)||{name,agents:{},categories:{},aliases:[],note:""}); window.deletePreset=delPreset; renderFieldGrid(); load();
  </script></body></html>`;
}

function handle(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url, `http://${HOST}:${port}`);
  const pageLang = url.searchParams.get("lang") === "en" ? "en" : "zh";

  if (req.method === "GET" && url.pathname === "/") { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(makeHTML(pageLang)); return; }
  if (req.method === "GET" && url.pathname === "/favicon.ico") { if (fs.existsSync(ICON_FILE)) { res.writeHead(200, { "Content-Type": "image/x-icon" }); res.end(fs.readFileSync(ICON_FILE)); } else { res.writeHead(404); res.end(); } return; }
  if (req.method === "GET" && url.pathname === "/api/presets") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(getPresetList())); return; }
  if (req.method === "GET" && url.pathname === "/api/current") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(getCurrentConfig())); return; }
  if (req.method === "GET" && url.pathname === "/api/custom-presets") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(getCustomPresetList())); return; }
  if (req.method === "GET" && url.pathname === "/api/preset-order") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(readOrder() || DEFAULT_ORDER)); return; }

  if (req.method === "POST" && url.pathname === "/api/switch") {
    let body = ""; req.on("data", (c) => { body += c; }); req.on("end", () => { try { const { name } = JSON.parse(body); if (!name) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "name is required" })); return; } const resolved = resolveName(name); if (!resolved || !activatePreset(resolved)) { res.writeHead(404, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: `Preset not found: ${name}` })); return; } res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: true, name: resolved })); } catch (err) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: err.message })); } }); return;
  }

  if (req.method === "POST" && url.pathname === "/api/custom-presets") {
    let body = ""; req.on("data", (c) => { body += c; }); req.on("end", () => { try { const { name, agents, categories, note, aliases } = JSON.parse(body); if (!name) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "name is required" })); return; } if (name === "default") { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "default cannot be edited" })); return; } if (!/^[a-zA-Z0-9-_]+$/.test(name)) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Invalid name: only letters, numbers, - and _ allowed" })); return; } const existing = getPresetRecord(name); if (existing && existing.kind !== "deleted") { res.writeHead(409, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Preset already exists" })); return; } if (!agents || !isObject(agents) || !Object.keys(agents).length) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "agents is required" })); return; } savePresetRecord(name, { agents, categories: categories || {}, note, aliases }); if (getCurrentName() === name) activatePreset(name); res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: true, name })); } catch (err) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: err.message })); } }); return;
  }

  if (req.method === "PUT" && url.pathname.startsWith("/api/custom-presets/")) {
    const name = decodeURIComponent(url.pathname.replace("/api/custom-presets/", "")); const existing = getPresetRecord(name); if (!existing || existing.kind === "deleted" || name === "default") { res.writeHead(404, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Preset not found" })); return; }
    let body = ""; req.on("data", (c) => { body += c; }); req.on("end", () => { try { const { agents, categories, note, aliases } = JSON.parse(body); if (!agents || !isObject(agents) || !Object.keys(agents).length) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "agents is required" })); return; } savePresetRecord(name, { agents, categories: categories || {}, note, aliases }); if (getCurrentName() === name) activatePreset(name); res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: true, name })); } catch (err) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: err.message })); } }); return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/custom-presets/")) {
    const name = decodeURIComponent(url.pathname.replace("/api/custom-presets/", "")); const existing = getPresetRecord(name); if (!existing || name === "default") { res.writeHead(404, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Preset not found" })); return; } deletePresetRecord(name); ensureActivePresetAfterDelete(name); res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: true })); return;
  }

  if (req.method === "POST" && url.pathname === "/api/preset-order") {
    let body = ""; req.on("data", (c) => { body += c; }); req.on("end", () => { try { const { order } = JSON.parse(body); if (!Array.isArray(order)) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "order must be an array" })); return; } saveOrder(order); res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: true })); } catch (err) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: err.message })); } }); return;
  }

  if (req.method === "POST" && url.pathname === "/api/shutdown") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    console.log("\n  Server shutting down...\n");
    setTimeout(() => process.exit(0), 500);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); res.end("Not Found");
}

const server = http.createServer(handle);
server.on("error", (err) => {
  if (err.code === "EADDRINUSE" || err.code === "EACCES") {
    promptNewPort(port, err.code);
    return;
  }
  throw err;
});
server.listen(port, HOST, () => { const localUrl = `http://127.0.0.1:${port}`; console.log(`\n  OMO Config Switcher Web UI\n`); console.log(`  Local:  ${localUrl}\n`); console.log(`  Presets: ${PRESET_DIR}`); console.log(`  Config:  ${LIVE_FILE}\n`); console.log(`  Stop: Ctrl+C\n`); openBrowser(localUrl); });

function openBrowser(url) { try { if (process.platform === "win32") execSync(`start "" "${url}"`, { stdio: "ignore" }); else if (process.platform === "darwin") execSync(`open "${url}"`, { stdio: "ignore" }); else execSync(`xdg-open "${url}"`, { stdio: "ignore" }); } catch {} }
