# pi GPT with Taste

> **本项目已停止维护**：GPT with Taste 上游现已提供 Pi 适配器。请前往[上游仓库](https://github.com/NB-Corp/gpt-with-taste)，按 [Pi 安装指南](https://github.com/NB-Corp/gpt-with-taste/blob/master/docs/harnesses/pi.md)使用。下方文档仅供旧版移植参考。

[English](README.md) · 简体中文

将 [GPT with Taste](https://github.com/NB-Corp/gpt-with-taste) 的判断力、持续执行、工程与视觉审美，以及面向读者的表达方式带入 pi。

扩展向符合范围的模型请求添加行为指令，并为新的用户输入补充简短提醒。指令使用英文，回复跟随用户最新语言；用户明确指定的人设、项目规则、工具和权限仍然优先。

## 快速开始

需要 **Node.js 22.19+** 和 **pi 1.2.0+**。在仓库根目录运行，即可单次试用：

```sh
pi -e ./src/index.ts
```

长期使用时，在同一目录安装：

```sh
pi install ./
```

启动新会话或运行 `/reload`，然后用 `/taste status` 查看状态。默认仅在以下条件同时满足时生效：

- provider 为 `openai` 或 `openai-codex`。
- 模型 ID 匹配 `/^gpt-/`，区分大小写。

本地安装引用当前仓库，请保留该目录。卸载时，在同一仓库根目录运行 `pi remove ./`，再重启或重载 pi。用户自行创建的配置文件会保留。

## 日常控制

| 命令 | 用途 |
| --- | --- |
| `/taste` 或 `/taste status` | 查看角色、选中模型、范围匹配、提醒、开关覆盖和配置来源 |
| `/taste on` / `/taste off` | 开启或关闭当前会话分支的指令注入 |
| `/taste steer on` / `/taste steer off` | 单独开启或关闭输入提醒 |
| `/taste config` | 查看有效配置、文件位置和项目信任状态 |
| `/taste reload` | 重读配置，保留分支开关覆盖 |
| `/taste reset` | 清除分支覆盖，重新服从配置 |

开关覆盖在恢复会话、扩展重载后保留，并跟随 fork 和树导航。`/taste on` 可以覆盖 `enabled: false`，但不能绕过模型范围或配置错误。非 UI 模式下，命令输出写入 stderr，不干扰 JSON/RPC 的 stdout。

## 配置模型范围

无需配置文件即可使用默认设置。需要自定义时，创建：

```text
<agent-dir>/extensions/pi-gpt-with-taste/config.json
```

`<agent-dir>` 默认为 `~/.pi/agent`，支持 `PI_CODING_AGENT_DIR`。运行 `/taste config` 可查看当前安装使用的位置。扩展只读取配置，不会自行创建或修改文件。

以 [config.example.json](config.example.json) 为起点：

```json
{
  "enabled": true,
  "steering": true,
  "providers": ["openai", "openai-codex"],
  "modelIdPattern": "/^gpt-/"
}
```

编辑后运行 `/taste reload`。

- `providers` 使用 pi provider ID，精确且区分大小写匹配。自定义 provider 需要显式加入；空列表不匹配任何提供商。
- `modelIdPattern` 是单个 `"/pattern/flags"` 字符串，匹配 `model.id`，不是显示名或 `provider/model`。正则遵循 Node.js `RegExp` 语义，最后一个斜线用于分隔 pattern 和 flags。
- 使用 `i` 忽略大小写，使用 `^` / `$` 限定完整匹配。JSON 中的反斜线需要转义，例如 `"/^gpt-6\\.1$/i"`。每次匹配都会重置 `g` / `y` 的位置。
- provider 和模型条件必须同时满足；未知模型不匹配。

### 项目级覆盖

受信任项目可以通过工作目录下的 `.pi/gpt-with-taste.json` 覆盖个别字段。该文件本身不会触发 pi 的信任提示；需要时使用 pi 的正常 `/trust` 流程。

优先级为 **内置默认 → 用户配置 → 可信项目配置**。提供商列表和正则均整体替换，不合并。

非法 JSON、未知字段、错误类型或正则，以及文件读取错误，都会暂停全部注入。后续配置层不能掩盖前一层错误。修正对应文件后运行 `/taste reload`。

## 手动安装

不使用 `pi install` 时，将 **`src/` 内的全部文件**以及 `resources/`、`LICENSE` 复制为以下结构：

```text
<agent-dir>/extensions/pi-gpt-with-taste/
├── index.ts
├── instructions.ts
├── … 其余源码文件
├── resources/
│   └── instructions/
│       ├── main.md
│       ├── sub.md
│       ├── user-steer.md
│       ├── sub-steer.md
│       └── agent-steer.md
├── LICENSE
└── config.json          # 可选用户配置
```

这种扁平布局不需要原来的 `package.json`、`node_modules/` 或 `dist/`。pi 自动发现 `index.ts`，并从相邻目录读取指令资源。

也可以保留包布局，一起复制 `package.json`、`src/`、`resources/` 和 `LICENSE`。manifest 加载 `src/index.ts`，指令资源从其上一级目录读取。

复制后重启 pi 或运行 `/reload`。只保留一种安装方式，并包含全部五份指令资源；仅复制源码不足以运行。

## 工作方式

每次模型请求都会重新检查**当前选中的**提供商和模型，将完整 Main 指令加入独立的 system section，并在尚未回答的用户输入后插入隐藏提醒。这包括排队的 steering 和 follow-up；普通工具续轮不重复提醒。

最终请求补齐逻辑会在强制系统提示词处理移除完整指令时恢复它。支持 OpenAI Responses/Codex Responses，以及已有 system/developer 消息的 Chat Completions 格式。已有指令（包括 automode 权限指导）保持不变；完整指令已存在时不会重复添加。

指令和提醒只存在于当前请求，不写入会话记录。只有分支开关覆盖保存在模型上下文之外。扩展不修改模型、推理等级、权限、工具、MCP、项目指令或技能，也不会主动发起额外模型调用、轮次、测试或付费调用。

### 兼容边界

- 范围依据选中的模型判断，不依据虚拟模型最终路由到的物理模型。
- 不支持的请求格式仍保留 system section 注入，但最终请求补齐无法恢复被强制提示词替换的指令；遇到此限制会显示警告。
- 后执行的请求重写扩展仍可能覆盖结果。
- 关闭扩展只停止后续追加，不撤销历史回答已经受到的影响。

默认角色为 Main。[协作扩展集成 API](docs/integration.md) 提供显式 Sub 指令和已完成结果提醒，不自动改写第三方子 Agent，也不包含调度器。实现细节见 [架构与兼容说明](docs/architecture.md)。

## 查看实际指令送达情况

`/taste status` 显示范围匹配，不代表最终请求一定包含完整指令。需要检查请求时，先加载实际安装的 taste 入口，再加载 pi 的 `provider-payload.ts` 日志示例：

```sh
pi -e "<installed-taste-entry>" -e "<pi-source>/packages/coding-agent/examples/extensions/provider-payload.ts"
```

将占位符替换为自己的位置。扁平安装使用已安装的 `index.ts`，包布局使用 `src/index.ts`，不要指向另一份仓库副本。相同入口会按规范路径去重，即使也被自动发现，也不会重复加载。

当前项目需要已有 `.pi` 目录。发送新消息后，查看 `.pi/provider-payload.log` 的最新请求。对于 Codex Responses，顶层 `instructions` 应包含 `<gpt-with-taste>` 和完整 Main 文本；输入提醒使用 `<gpt-with-taste-user-steer>`。只有提醒标记不代表完整指令送达。

pi 1.2.0 先加载命令行 `-e` 扩展，再加载自动发现的扩展，并按此顺序串联请求处理。仅显式加载日志扩展，可能记录到 taste 补齐之前的请求。日志包含对话内容，请勿公开；退出临时日志会话即可停止记录。`/taste off` 后的新请求不再追加本扩展指令。

## 开发

```sh
npm install --include=dev --ignore-scripts
npm run build
```

构建仅编译 TypeScript。pi 直接加载源码，使用前无需构建。开发依赖不会升级全局安装的 pi。

## 来源与许可

改编自 [NB-Corp/gpt-with-taste](https://github.com/NB-Corp/gpt-with-taste)。来源和适配记录见 [upstream.md](docs/upstream.md)，采用 [MIT 许可证](LICENSE)。
