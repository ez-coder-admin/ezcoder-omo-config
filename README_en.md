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
| `default` | `d` | All MiniMax M2.5 Free |
| `gpt` | `g` | All GPT-5.4 |
| `gpt-mini` | `gm` | Hephaestus uses Copilot GPT-5-mini |
| `code` | `c` | Claude Opus 4 for heavy reasoning |
| `mimo` | `m` | Hephaestus uses MiMo V2 Pro Free |

> **Rule**: NEVER use Sisyphus with GPT (except GPT-5.4). All presets follow this rule.

## Commands

```bash
omo              # Show current global config
omo <preset>     # Switch global config
omo -p           # Show current project config
omo <preset> -p  # Switch project config
omo -l           # List all global presets
omo -l -p        # List all project presets
omo -config      # Start Web UI (also -c / -s)
omo -config 8080  # Start on specified port
omo -h           # Show help
```

## Web UI (Optional)

A web interface for managing presets via browser:

```bash
omo -config           # Start Web UI (default port 1314)
omo -c               # Same as above
omo -s               # Same as above
omo -config 3000     # Specify port
```

Browser opens automatically at **http://127.0.0.1:1314**

- Shows all preset cards, yellow border = currently active
- Click a card to switch preset
- Live display of current config name and aliases
- Supports Chinese/English

API endpoints:

| Method | Path | Description |
|---|---|---|
| GET | `/` | Web UI |
| GET | `/api/presets` | List all presets |
| GET | `/api/current` | Current active config |
| POST | `/api/switch` | Switch preset (body: `{"name":"mimo"}`) |

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

OpenCode reads config on each startup. After switching, **restart OpenCode** to apply changes.

## Adding Custom Presets

1. Create a new file in `lib/presets/` (e.g., `mypreset.json`)
2. Edit `lib/presets/aliases.json` to add alias mappings

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
  "mypreset": ["mp"]
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
│   ├── omo.js              # CLI entry point
│   └── omo-server.js       # Web UI server
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
