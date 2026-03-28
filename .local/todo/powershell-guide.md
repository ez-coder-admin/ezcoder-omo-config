# PowerShell 配置直连 Web UI 待做需求

## 背景

当前用户希望把常用的 PowerShell 快捷命令配置能力，直接放到 `omo` 的 Web UI 中完成，而不是手动编辑 `$PROFILE`。

这里有两类能力需要支持：

- `Set-Alias`
- `function`

它们都属于 PowerShell 自带能力，不需要额外安装，适合作为后续 Web 配置功能的一部分。

## 目标

在 Web UI 中提供一个可视化入口，让用户可以直接配置并管理 PowerShell 快捷命令。

目标场景：

- 快速给命令创建短别名
- 快速给固定目录、固定参数、组合命令创建函数
- 降低用户手动查找和编辑 `$PROFILE` 的门槛

## 功能范围

### 1. Alias 配置

支持用户在 Web UI 中配置 PowerShell alias。

示例：

```powershell
Set-Alias oc opencode
Set-Alias omo-help omo
```

适用场景：

- 短命令映射
- 简化已有命令名

说明：

- `Set-Alias` 更适合单命令映射
- 不适合固定目录、固定参数、复杂逻辑

### 2. Function 配置

支持用户在 Web UI 中配置 PowerShell function。

示例：

```powershell
function ocomo {
    opencode D:\Project\ezcoder-omo-config
}
```

```powershell
function omo-web {
    node D:\Project\ezcoder-omo-config\bin\omo-server.js
}
```

适用场景：

- 固定目录
- 固定参数
- 多步命令
- 组合命令

说明：

- 对当前 `omo` / `opencode` 使用场景来说，`function` 比单纯 alias 更实用

## 建议的 Web 交互

### 1. 新增一个 PowerShell Config 区域

建议在 Web UI 中新增一个独立区域，例如：

- `PowerShell`
- `Shell Config`
- `Quick Commands`

用于集中管理 PowerShell 快捷命令。

### 2. 区分两种类型

建议在 UI 中明确区分：

- Alias
- Function

可以考虑：

- Tab 切换
- 下拉选择类型
- 卡片列表中标记类型

### 3. 表单字段建议

#### Alias

建议字段：

- 名称，例如 `oc`
- 目标命令，例如 `opencode`

生成结果示例：

```powershell
Set-Alias oc opencode
```

#### Function

建议字段：

- 名称，例如 `ocomo`
- 命令体，例如 `opencode D:\Project\ezcoder-omo-config`

生成结果示例：

```powershell
function ocomo {
    opencode D:\Project\ezcoder-omo-config
}
```

后续如果要增强，可以再支持：

- 多行命令体
- 描述/备注
- 启用/禁用

## 配置落点

目标写入位置应为 PowerShell 的 `$PROFILE` 文件。

说明：

- 当前终端里直接执行 `Set-Alias` / `function` 只是临时生效
- 要想关闭 PowerShell 再打开依然有效，必须写入 `$PROFILE`

因此 Web 功能本质上应当是：

- 读取 `$PROFILE`
- 识别和管理由 `omo` 生成的配置块
- 写回 `$PROFILE`

## 推荐实现方式

建议由 `omo` 写入一个受控配置块，避免覆盖用户已有的自定义内容。

例如：

```powershell
# >>> omo powershell config start >>>
Set-Alias oc opencode

function ocomo {
    opencode D:\Project\ezcoder-omo-config
}
# <<< omo powershell config end <<<
```

这样后续更新时可以只替换这一个区块，而不破坏用户其他手写内容。

## 核心需求

### 1. 读取现有 PowerShell 配置

Web UI 需要能读取：

- `$PROFILE` 路径
- `$PROFILE` 文件是否存在
- 由 `omo` 管理的配置块内容

### 2. 写入 PowerShell 配置

Web UI 需要支持：

- 首次创建 `$PROFILE`
- 如果父目录不存在则自动创建
- 将 alias / function 写入受控配置块
- 更新时只替换受控配置块

### 3. 删除 PowerShell 配置项

Web UI 需要支持：

- 删除单个 alias
- 删除单个 function
- 如果受控块空了，可保留空块或直接移除整个块

### 4. 预览生成结果

建议支持：

- 配置前预览最终生成的 PowerShell 代码
- 告知用户“这是写入 `$PROFILE` 的内容”

## 需要注意的问题

### 1. 不要破坏用户原有 `$PROFILE`

必须避免整文件覆盖。

建议：

- 仅管理带有 `omo` 标记的区块
- 其他内容原样保留

### 2. 名称校验

Alias / function 名称需要做合法性校验。

例如需要避免：

- 空名称
- 明显非法字符
- 与 PowerShell 保留命令强冲突的情况

### 3. 命令体安全性

如果允许自由输入 function 命令体，需要考虑：

- 是否允许多行
- 是否限制危险命令
- 是否只先支持简单单行命令

第一版建议先做保守：

- Alias 只支持一对一映射
- Function 先支持单行命令体

### 4. 生效方式说明

写入 `$PROFILE` 后，不代表当前已打开的 PowerShell 窗口立即自动生效。

需要在 UI 中提示用户：

- 重新打开 PowerShell
- 或执行 `. $PROFILE`

## 和当前项目的关系

这个功能适合当前 `omo` 项目，因为用户实际使用中经常有这些需求：

- 快速进入某个项目目录
- 快速启动 `opencode`
- 快速启动 `omo`
- 快速运行 `omo` Web UI

典型例子：

```powershell
Set-Alias oc opencode
```

```powershell
function ocomo {
    opencode D:\Project\ezcoder-omo-config
}
```

```powershell
function omo-web {
    node D:\Project\ezcoder-omo-config\bin\omo-server.js
}
```

## 第一版建议

第一版建议优先做到：

1. Web UI 中新增 PowerShell Config 管理页
2. 支持新增 / 编辑 / 删除 alias
3. 支持新增 / 编辑 / 删除 function
4. 写入 `$PROFILE` 的 `omo` 受控配置块
5. 提示用户如何立即生效

## 后续可扩展方向

- 支持多套 shell，例如 PowerShell / bash / zsh
- 支持导入现有 `$PROFILE` 中的 alias / function
- 支持检测冲突名称
- 支持一键生成常用模板
- 支持与 `opencode` / `omo` 项目路径联动生成快捷命令
