# AGENTS.md - ezcoder-omo-config

## Project Overview

OpenCode oh-my-opencode 配置预设切换 CLI 工具 + Web UI。

## 已完成功能

- ✅ CLI 命令切换预设 (`omo mimo`, `omo gpt`, etc.)
- ✅ Web UI 管理预设 (`omo -config` 或 `omo -c`)
- ✅ 自定义预设 (添加/编辑/删除)
- ✅ Individual input fields 表单 (agents/categories)
- ✅ Note 和 Aliases 字段
- ✅ 拖拽重排序
- ✅ 浮动 toast 提示 (不占用 DOM)
- ✅ 中英文双语支持

## 技术栈

- Node.js CLI + HTTP Server
- 原生 JavaScript (无框架)
- CSS 样式内联

## 常用命令

```bash
# 安装
npm install -g ezcoder-omo-config

# CLI 用法
omo              # 查看当前配置
omo -l           # 列出所有预设
omo mimo         # 切换到 mimo 预设

# Web UI
omo -config     # 启动 Web UI (默认端口 1314)
omo -c 8080     # 指定端口
omo -e          # 英文界面

# 发布
npm version patch
npm publish --access public
```

## 文件结构

```
ezcoder-omo-config/
├── bin/
│   ├── omo.js           # CLI 入口
│   └── omo-server.js   # Web UI 服务器
├── lib/
│   └── presets/         # 内置预设
│       ├── default.json
│       ├── gpt.json
│       └── ...
├── package.json
└── README.md
```

## 开发注意事项

1. **表单逻辑**: 使用 individual input fields (`data-agent`, `data-cat` 属性)，从 `document.querySelectorAll('[data-agent]')` 读取
2. **提示**: 使用 `toast()` 函数，不使用 `showError()`/`showSuccess()` (已移除)
3. **版本号**: 每次 `npm publish` 前需要 `npm version patch`
4. **语法检查**: `node --check bin/omo-server.js`
