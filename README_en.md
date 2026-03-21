# ezcoder-omo-config

A preset switcher for OpenCode [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode).

Switch between different agent/model presets with a single command — no manual config editing required.

## Install

### Option 1: npm (Recommended)

```bash
npm install -g ezcoder-omo-config
```

> If your npm registry is not the official one (e.g. China mirrors), switch back first:
> ```bash
> npm config set registry https://registry.npmjs.org/
> npm install -g ezcoder-omo-config
> ```
> Or specify the registry directly without modifying global config:
> ```bash
> npm install -g ezcoder-omo-config --registry=https://registry.npmjs.org/
> ```

### Option 2: From GitHub

```bash
npm install -g github:ez-coder-admin/ezcoder-omo-config
# specify a version
npm install -g github:ez-coder-admin/ezcoder-omo-config#v1.0.0
```

## Quick Start

```bash
omo              # Show current global config
omo -l           # List all presets
omo mimo         # Switch to mimo preset
omo m            # Use alias (m = mimo)
omo gpt-mini     # Switch to gpt-mini preset
```

## Presets

Built-in presets covering different scenarios:

| Preset | Alias | Description |
|---|---|---|
| `default` | `d` | All MiniMax M2.5 Free, most cost-effective |
| `gpt` | `g` | All GPT-5.4 / GPT-5.3-codex, requires OpenAI API Key |
| `gpt-mini` | `gm` | Hephaestus/complex tasks use Copilot GPT-5-mini, others MiniMax |
| `code` | `c` | Claude Opus 4.5/4.6 for heavy reasoning, GPT-5.4 for vision, GPT-4 for light tasks |
| `mimo` | `m` | Hephaestus/complex tasks use MiMo V2 Pro Free, others MiniMax M2.5 Free |

> **Rule**: NEVER use Sisyphus with GPT (except GPT-5.4). All presets follow this rule.

## Commands

```bash
omo              # Show current global config (with name + alias)
omo <preset>     # Switch global config
omo -p           # Show current project config
omo <preset> -p  # Switch project config
omo -l           # List all global presets
omo -l -p        # List all project presets
omo -h           # Show help
```

### Alias Usage

```bash
omo d    # = omo default
omo g    # = omo gpt
omo gm   # = omo gpt-mini
omo c    # = omo code
omo m    # = omo mimo
```

## Where Config Is Written

- **Global config**: `~/.config/opencode/oh-my-opencode.jsonc` (fallback when no project config)
- **Project config**: `<cwd>/.opencode/oh-my-opencode.json` (written when using `-p`)
- **Presets source**: npm package built-in (`lib/presets/`), read-only
- **Switch record**: `~/.config/opencode/oh-my-opencode-role-name.json` (stores current preset name)

## How It Works

```
omo <preset>
  ├─ Read preset JSON from npm package lib/presets/
  └─ Write to ~/.config/opencode/oh-my-opencode.jsonc  ← OpenCode reads on startup
```

OpenCode reads `~/.config/opencode/oh-my-opencode.jsonc` (or project `.opencode/oh-my-opencode.json`) on each startup. After switching, **restart OpenCode** or run `/config reload` in the TUI to apply changes.

## Adding Custom Presets

1. Create a new file in `lib/presets/` (e.g., `mypreset.json`)
2. Edit `lib/presets/aliases.json` to add alias mappings
3. Update the preset list in `bin/omo.js` help text (optional)

```json
// lib/presets/mypreset.json
{
  "$schema": "https://raw.githubusercontent.com/code-yeongyu/oh-my-opencode/dev/assets/oh-my-opencode.schema.json",
  "agents": {
    "sisyphus": { "model": "opencode/minimax-m2.5-free" },
    "hephaestus": { "model": "opencode/mimo-v2-pro-free" },
    ...
  },
  "categories": { ... }
}
```

```json
// lib/presets/aliases.json
{
  "default": ["d"],
  "gpt": ["g"],
  "gpt-mini": ["gm"],
  "code": ["c"],
  "mimo": ["m"],
  "mypreset": ["mp"]   // Add custom
}
```

## Uninstall

```bash
npm uninstall -g ezcoder-omo-config
```

Optional: clear local cache:

```bash
rm ~/.config/opencode/oh-my-opencode-role-name.json
```

## Project Structure

```
ezcoder-omo-config/
├── package.json
├── bin/
│   └── omo.js              # CLI entry point
└── lib/
    └── presets/             # Built-in presets (inside npm package)
        ├── aliases.json
        ├── default.json
        ├── gpt.json
        ├── gpt-mini.json
        ├── code.json
        └── mimo.json
```

## License

MIT
