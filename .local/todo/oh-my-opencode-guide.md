# oh-my-opencode 安装与官方配置教程

这份文档面向 Windows + PowerShell 环境，目标是把 `oh-my-opencode` 从“包已安装”带到“可以在 OpenCode 中正常工作”。

官方参考：

- 安装文档: https://ohmyopencode.com/installation/
- 配置文档: https://ohmyopencode.com/configuration/
- 项目主页: https://github.com/code-yeongyu/oh-my-opencode

## 1. 先明确几个角色

- `OpenCode`：主程序，本体
- `oh-my-opencode`：OpenCode 的插件/增强层
- `ezcoder-omo-config`：预设切换工具，用来切换 `oh-my-opencode` 的配置预设

如果只安装了 `ezcoder-omo-config`，并不等于已经装好了 `oh-my-opencode`。

## 2. 安装 oh-my-opencode

```powershell
npm install -g oh-my-opencode --registry=https://registry.npmjs.org/
```

安装完成后可以先查看版本：

```powershell
oh-my-opencode version
```

如果需要查看帮助：

```powershell
oh-my-opencode --help
```

## 3. 初始化安装

安装包本体后，还需要把它注册到 OpenCode 配置中。

最常用的方式：

```powershell
oh-my-opencode install
```

这个命令会做几件事：

- 检查本机是否已安装 OpenCode
- 把 `oh-my-opencode` 注册到 OpenCode 配置
- 引导你选择可用的模型来源
- 生成或更新相关配置文件

如果你想非交互执行，也可以使用：

```powershell
oh-my-opencode install --no-tui --claude=no --openai=no --gemini=no --copilot=no --opencode-zen=no --zai-coding-plan=no --kimi-for-coding=no --opencode-go=no --skip-auth
```

说明：

- `install` 是初始化/注册命令
- 只执行 `npm install -g oh-my-opencode` 还不够
- 没有完成 `install` 时，`doctor` 通常会提示 `oh-my-opencode is not registered`

## 4. 安装后验证

安装完成后运行健康检查：

```powershell
oh-my-opencode doctor
```

常用附加选项：

```powershell
oh-my-opencode doctor --status
oh-my-opencode doctor --verbose
oh-my-opencode doctor --json
```

`doctor` 的作用是检查：

- 是否已经注册成功
- 是否缺少依赖
- 是否检测到 LSP
- 是否缺少 GitHub CLI 等可选工具

注意：`doctor` 是检查命令，不负责安装。

## 5. 官方配置文件位置

根据官方配置文档，`oh-my-opencode` 支持用户级和项目级配置。

常见位置：

- 用户级配置：`C:\Users\admin\.config\opencode\oh-my-opencode.json`
- 项目级配置：`<项目目录>\.opencode\oh-my-opencode.json`
- OpenCode 主配置：`C:\Users\admin\.config\opencode\opencode.json`

读取优先级通常是：

- 项目级配置优先
- 用户级配置兜底

也就是说，如果项目目录里有 `.opencode\oh-my-opencode.json`，它通常会覆盖用户级同名配置中的对应行为。

## 6. 官方配置项大类

根据官方配置文档，常见配置项包括：

- `agents`
- `disabled_hooks`
- `disabled_mcps`
- `lsp`
- `experimental`

可以先从一个最小配置开始。

## 7. 最小可用配置示例

下面是一份适合先测试的 `oh-my-opencode.json` 示例：

```json
{
  "$schema": "https://raw.githubusercontent.com/code-yeongyu/oh-my-opencode/master/assets/oh-my-opencode.schema.json",
  "agents": {
    "planner-sisyphus": {
      "enabled": true,
      "replace_plan": true
    },
    "librarian": {
      "enabled": false
    },
    "explore": {
      "enabled": false
    },
    "oracle": {
      "enabled": false
    }
  },
  "disabled_hooks": [
    "comment-checker"
  ],
  "disabled_mcps": [],
  "experimental": {
    "auto_resume": false
  }
}
```

这份配置的思路是：

- 先启用核心规划代理
- 先关闭不急用的额外代理
- 如果本机没有安装 comment checker，就先在配置中禁用对应 hook
- 先用最小配置把主流程跑通

## 8. LSP 配置示例

如果你要启用 LSP，可以按官方格式在 `lsp` 中配置语言服务器。

例如 TypeScript：

```json
{
  "lsp": {
    "typescript-language-server": {
      "command": ["typescript-language-server", "--stdio"],
      "extensions": [".ts", ".tsx"],
      "priority": 10
    }
  }
}
```

要点：

- `command` 是实际启动语言服务器的命令
- `extensions` 表示该 LSP 负责的文件扩展名
- `priority` 用来控制多个候选 LSP 的优先级

如果 `doctor` 报 `No LSP servers detected`，通常说明本机还没装任何语言服务器，或者命令不在 PATH 里。

## 9. Windows / PowerShell 常见问题

### 9.1 `npm` 或 `oh-my-opencode` 无法运行脚本

表现通常类似：

- `xxx.ps1 because running scripts is disabled on this system`

解决方式：

- 优先直接使用 `npm`
- 优先直接使用 `oh-my-opencode`
- 不要直接依赖 `.ps1` 包装脚本

示例：

```powershell
npm list -g oh-my-opencode
oh-my-opencode doctor
```

如果你的 PowerShell 执行策略刚好拦住了脚本包装器，再退回使用 `.cmd` 版本即可，例如：

```powershell
npm.cmd list -g oh-my-opencode
oh-my-opencode.cmd doctor
```

### 9.2 `doctor` 提示 `oh-my-opencode is not registered`

这表示包已经装了，但 OpenCode 配置里还没有插件注册项。

先执行：

```powershell
oh-my-opencode install
```

然后再检查：

```powershell
oh-my-opencode doctor
```

### 9.3 `doctor` 提示缺少 comment checker

这是可选能力，不是主流程必须项。

你可以：

- 安装 `@code-yeongyu/comment-checker`
- 或者在 `oh-my-opencode.json` 里把 `comment-checker` 放到 `disabled_hooks`

### 9.4 `doctor` 提示没有 LSP

这不影响基础使用，但会影响：

- diagnostics
- rename
- references

如果暂时只是测试主流程，可以先忽略；需要更强的代码能力时再补装对应语言服务器。

## 10. 和 omo 的关系

如果你同时安装了这个项目里的 `omo` 工具，那么常见使用顺序是：

1. 先安装并初始化 `oh-my-opencode`
2. 确认 `doctor` 通过基本检查
3. 再用 `omo` 切换不同预设

例如：

```powershell
omo -l
omo mimo
```

`omo` 的作用不是安装 `oh-my-opencode`，而是切换 `oh-my-opencode` 的配置预设。

## 11. 推荐的实际操作顺序

如果你是第一次配置，建议按下面顺序走：

```powershell
npm install -g oh-my-opencode --registry=https://registry.npmjs.org/
oh-my-opencode version
oh-my-opencode install
oh-my-opencode doctor
```

如果确认可用，再去做预设切换：

```powershell
npm install -g ezcoder-omo-config --registry=https://registry.npmjs.org/
omo -l
omo mimo
```

## 12. 当前这台机器最值得优先确认的点

如果你是在这台 Windows 机器上继续测试，最优先确认这三件事：

1. `oh-my-opencode install` 是否已经真正写入 OpenCode 配置
2. `oh-my-opencode doctor` 是否还提示 `not registered`
3. 用户级配置文件里是否已经出现有效的 `agents` / `hooks` / `lsp` 配置

只要这三步通了，后面再切 `omo` 预设就会顺很多。
