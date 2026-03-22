#!/usr/bin/env node
"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");

// ── Paths ────────────────────────────────────────────────────────────────────
const CONFIG_DIR = path.join(os.homedir(), ".config", "opencode");
const PRESET_DIR = path.join(__dirname, "..", "lib", "presets");
const HELP_FILE = path.join(__dirname, "..", "lib", "help.json");
const ROLE_FILE = path.join(CONFIG_DIR, "oh-my-opencode-role.json");
const ROLE_NAME_FILE = path.join(CONFIG_DIR, "oh-my-opencode-role-name.json");
const LIVE_FILE = path.join(CONFIG_DIR, "oh-my-opencode.jsonc");
const ALIAS_FILE = path.join(PRESET_DIR, "aliases.json");
const PROJECT_FILE = path.join(process.cwd(), ".opencode", "oh-my-opencode.json");

// ── Colors ────────────────────────────────────────────────────────────────────
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const reset = () => ``;

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
  // Check if input itself is a preset name
  const presetFile = path.join(PRESET_DIR, `${input}.json`);
  if (fs.existsSync(presetFile)) return input;
  return null;
}

function formatLine(name, value, indent = 2) {
  const pad = " ".repeat(indent);
  return `${pad}${name.padEnd(22)}${value}`;
}

function getProjectName() {
  if (!fs.existsSync(PROJECT_FILE)) return null;
  const content = readJSON(PROJECT_FILE);
  return content && content._omo_name ? content._omo_name : null;
}

// ── Actions ───────────────────────────────────────────────────────────────────
function showCurrent(scope) {
  let config, name;

  if (scope === "project") {
    if (!fs.existsSync(PROJECT_FILE)) {
      console.log(dim("[No project config]"));
      return;
    }
    config = readJSON(PROJECT_FILE);
    name = getProjectName();
  } else {
    config = readJSON(LIVE_FILE);
    name = getCurrentName();
  }

  if (!config) {
    console.log(dim("[No config found]"));
    return;
  }

  const aliases = getAliases();
  let label = "[current]";
  if (name) {
    const al = aliases[name];
    const aliasStr = al ? ` (${Array.isArray(al) ? al.join(", ") : al})` : "";
    const prefix = scope === "project" ? "Project " : "";
    label = `[${prefix}Current: ${bold(name)}${aliasStr}]`;
  }

  console.log(label);
  if (config.agents) {
    for (const [agent, val] of Object.entries(config.agents)) {
      console.log(formatLine(agent, val.model));
    }
  }
  if (config.categories) {
    console.log(dim("[Categories]"));
    for (const [cat, val] of Object.entries(config.categories)) {
      console.log(formatLine(cat, val.model));
    }
  }
}

function listPresets(scope) {
  const aliases = getAliases();
  const currentName = getCurrentName();
  const files = fs.readdirSync(PRESET_DIR).filter((f) => f.endsWith(".json") && f !== "aliases.json");

  if (scope === "global") {
    console.log(bold("[Global Presets]"));
  } else {
    console.log(bold("[Project Presets]"));
  }

  for (const file of files.sort()) {
    const name = path.basename(file, ".json");
    const preset = readJSON(path.join(PRESET_DIR, file));
    const al = aliases[name];
    const aliasStr = al ? ` (${Array.isArray(al) ? al.join(", ") : al})` : "";
    const curMark = name === currentName ? ` ${green("[current]")}` : "";
    console.log(`  ${cyan("[" + name + "]")}${aliasStr}${curMark}`);
    if (preset && preset.agents) {
      for (const [agent, val] of Object.entries(preset.agents)) {
        console.log(formatLine(agent, val.model, 4));
      }
    }
    if (preset && preset.categories) {
      for (const [cat, val] of Object.entries(preset.categories)) {
        console.log(formatLine(cat, val.model, 4));
      }
    }
    console.log();
  }

  if (scope === "global") {
    if (fs.existsSync(PROJECT_FILE)) {
      console.log(dim("[Project Config exists]"));
    } else {
      console.log(dim("[No project config]"));
    }
  }
}

function switchPreset(input, scope) {
  const name = resolveName(input);
  if (!name) {
    console.error(`Config not found: ${input}`);
    process.exit(1);
  }

  const presetFile = path.join(PRESET_DIR, `${name}.json`);
  if (!fs.existsSync(presetFile)) {
    console.error(`Preset file not found: ${presetFile}`);
    process.exit(1);
  }

  const preset = readJSON(presetFile);
  // Remove _omo_name internal field before writing
  const { _omo_name, ...cleanPreset } = preset || {};

  if (scope === "project") {
    fs.mkdirSync(path.dirname(PROJECT_FILE), { recursive: true });
    writeJSON(PROJECT_FILE, { ...cleanPreset, _omo_name: name });
    console.log(`  ${green("Switched project to:")} ${bold(name)} (${input})`);
  } else {
    writeJSON(LIVE_FILE, cleanPreset);
    writeJSON(ROLE_NAME_FILE, { role: name });
    writeJSON(ROLE_FILE, cleanPreset);
    console.log(`  ${green("Switched to:")} ${bold(name)} (${input})`);
  }

  showCurrent(scope);
}

function showHelp() {
  const h = JSON.parse(fs.readFileSync(HELP_FILE, "utf8"));
  const lw = 24;
  const pw = 10;
  const sep = dim("  ───────────────────────────────────────────────────────────────");
  const sep2 = dim("  ─────────────────────────────────────────────────────────────────");

  const uEn = h.usage.map((u) => `  ${cyan(u.cmd.padEnd(lw))} ${u.desc_en}`).join("\n");
  const uZh = h.usage.map((u) => `  ${cyan(u.cmd.padEnd(lw))} ${u.desc_zh}`).join("\n");
  const pEn = h.presets.map((p) => `  ${p.name.padEnd(pw)} ${dim("(" + p.alias + ")  " + p.desc_en)}`).join("\n");
  const pZh = h.presets.map((p) => `  ${p.name.padEnd(pw)} ${dim("(" + p.alias + ")  " + p.desc_zh)}`).join("\n");

  console.log(`${bold(h.title.en)} / ${h.title.zh}
${dim(h.subtitle.en)}
${dim(h.subtitle.zh)}

${bold("EN ─────────────────────────────────────────────────────────────")}
${uEn}
${sep}
${pEn}

${bold("中文 ──────────────────────────────────────────────────────────")}
${uZh}
${sep2}
${pZh}
`);
}

// ── CLI Parser ─────────────────────────────────────────────────────────────────
function parseArgs(args) {
  let action = "show";
  let scope = "global";
  let preset = null;
  let port = null;
  let serverFlags = [];

  const VALID_SHORT_FLAGS = new Set(["p", "l", "h", "config", "c", "s"]);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-p" || arg === "--project") {
      scope = "project";
    } else if (arg === "-l" || arg === "--list") {
      action = "list";
    } else if (arg === "-h" || arg === "--help") {
      action = "help";
    } else if (arg === "-config" || arg === "-c" || arg === "-s") {
      action = "server";
      while (i + 1 < args.length) {
        const next = args[i + 1];
        if (/^\d+$/.test(next)) {
          port = next;
          i++;
        } else if (next === "-e" || next === "--en") {
          serverFlags.push(next);
          i++;
        } else {
          break;
        }
      }
    } else if (arg.startsWith("-") && !VALID_SHORT_FLAGS.has(arg.slice(1))) {
      console.error(`Unknown option: ${arg}`);
      console.error(`Valid options: -p, -l, -h, -config (or -c, -s)`);
      console.error("Use 'omo -h' for help");
      process.exit(1);
    } else if (!arg.startsWith("-")) {
      preset = arg;
      action = "switch";
    }
  }

  return { action, scope, preset, port, serverFlags };
}

// ── Main ───────────────────────────────────────────────────────────────────────
function main() {
  const { action, scope, preset, port, serverFlags } = parseArgs(process.argv.slice(2));

  switch (action) {
    case "help":
      showHelp();
      break;
    case "list":
      listPresets(scope);
      break;
    case "switch":
      switchPreset(preset, scope);
      break;
    case "server": {
      const { spawn } = require("child_process");
      const srvPath = path.join(__dirname, "omo-server.js");
      const portArg = port ? [port] : [];
      const child = spawn("node", [srvPath, ...portArg, ...serverFlags], { stdio: "inherit" });
      child.on("error", (e) => { console.error(e.message); process.exit(1); });
      break;
    }
    case "show":
    default:
      showCurrent(scope);
      break;
  }
}

main();
