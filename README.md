# ezcoder-omo-config

OpenCode [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) 配置预设切换工具。

通过简单的命令在不同的 agent/model 预设之间切换，无需手动编辑配置文件。

## 安装

### 方式一：npm（推荐）

```bash
npm install -g ezcoder-omo-config
```

> 如果 npm 默认源不是官方源（如国内镜像），请先切换回官方源：
> ```bash
> npm config set registry https://registry.npmjs.org/
> npm install -g ezcoder-omo-config
> ```
> 或直接指定源安装，无需修改全局配置：
> ```bash
> npm install -g ezcoder-omo-config --registry=https://registry.npmjs.org/
> ```

### 方式二：从 GitHub 安装

```bash
npm install -g github:ez-coder-admin/ezcoder-omo-config
# 指定版本
npm install -g github:ez-coder-admin/ezcoder-omo-config#v1.0.0
```

## 快速开始

```bash
omo              # 查看当前全局配置
omo -l           # 列出所有预设
omo mimo         # 切换到 mimo 预设
omo m            # 用别名切换（m = mimo）
omo gpt-mini     # 切换到 gpt-mini 预设
```

## 预设说明

内置 5 个预设，覆盖不同场景：

| 预设 | 别名 | 说明 |
|---|---|---|
| `default` | `d` | 全员 MiniMax M2.5 Free |
| `gpt` | `g` | 全员 GPT-5.4 |
| `gpt-mini` | `gm` | Hephaestus 用 Copilot GPT-5-mini |
| `code` | `c` | Claude Opus 4 做高强度推理 |
| `mimo` | `m` | Hephaestus 用 MiMo V2 Pro Free |

> **规则**：NEVER 用 Sisyphus 配合 GPT（GPT-5.4 除外）。所有预设均遵循此规则。

## 命令参考

```bash
omo              # 查看当前全局配置
omo <preset>     # 切换全局配置
omo -p           # 查看当前项目配置
omo <preset> -p  # 切换项目配置
omo -l           # 列出所有全局预设
omo -l -p        # 列出所有项目预设
omo -config      # 启动 Web UI（也可 -c / -s）
omo -config 8080 # 指定端口启动
omo -h           # 显示帮助
```

## Web UI（可选）

提供 Web 界面，通过浏览器管理预设：

```bash
omo -config           # 启动 Web UI（默认端口 9527）
omo -c               # 同上，简写
omo -s               # 同上，简写
omo -config 3000     # 指定端口
```

启动后自动打开浏览器访问 **http://127.0.0.1:9527**

- 展示所有预设卡片，黄色边框为当前激活
- 点击卡片直接切换预设
- 实时显示当前配置名称和别名
- 支持中英文切换

API 端点：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/` | Web 界面 |
| GET | `/api/presets` | 所有预设列表 |
| GET | `/api/current` | 当前激活配置 |
| POST | `/api/switch` | 切换预设（body: `{"name":"mimo"}`） |

## 配置写入位置

- **全局配置**：`~/.config/opencode/oh-my-opencode.jsonc`（项目配置不存在时的兜底）
- **项目配置**：`<cwd>/.opencode/oh-my-opencode.json`（`-p` 时写入，覆盖全局）
- **预设来源**：npm 包内置预设文件（`lib/presets/`），不可修改
- **切换记录**：`~/.config/opencode/oh-my-opencode-role-name.json`（记录当前激活的 preset 名称）

## 工作原理

```
omo <preset>
  ├─ 从 npm 包的 lib/presets/ 读取 preset JSON
  └─ 写入 ~/.config/opencode/oh-my-opencode.jsonc  ← OpenCode 启动时读取
```

OpenCode 在每次启动时读取配置，切换 preset 后**需要重启 OpenCode** 使配置生效。

## 添加自定义预设

1. 在 `lib/presets/` 目录创建新文件（如 `mypreset.json`）
2. 编辑 `lib/presets/aliases.json` 添加别名映射

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

## 卸载

```bash
npm uninstall -g ezcoder-omo-config
```

清除本地缓存（可选）：

```bash
rm ~/.config/opencode/oh-my-opencode-role-name.json
```

## 项目结构

```
ezcoder-omo-config/
├── package.json
├── bin/
│   ├── omo.js              # CLI 入口
│   └── omo-server.js       # Web UI 服务器
└── lib/
    └── presets/             # 内置预设（npm 包内）
        ├── aliases.json
        ├── default.json
        ├── gpt.json
        ├── gpt-mini.json
        ├── code.json
        └── mimo.json
```

## License

MIT
