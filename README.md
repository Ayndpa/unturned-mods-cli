# utmod CLI

[Unturned Mods Hub](https://github.com/Ayndpa/unturned-mods) 官方命令行工具，用于在终端完成登录认证，以及创建、更新、查看与删除你上传的模组。支持交互式向导与脚本化参数（适合 CI/CD）。

命令名：`utmod`

## 环境要求

- [Bun](https://bun.sh/)（本包使用 Bun 运行与构建）

## 安装

### 从发布脚本安装（推荐）

安装脚本会编译单文件可执行程序，并放入 `~/.bun/bin`（需已加入 `PATH`）。

**Windows (PowerShell)**

```powershell
irm https://raw.githubusercontent.com/Ayndpa/unturned-mods-cli/main/install.ps1 | iex
```

**macOS / Linux**

```bash
curl -fsSL https://raw.githubusercontent.com/Ayndpa/unturned-mods-cli/main/install.sh | bash
```

### 从本仓库源码运行

```bash
cd cli
bun install
bun run start -- auth status
```

在开发时可直接用 Bun 执行入口：

```bash
bun src/index.ts mod list
```

将 `utmod` 链接到全局（可选）：

```bash
cd cli
bun link
```

## 配置

凭证与默认主机保存在用户目录下的 **`~/.utmod-config.json`**：

| 字段 | 说明 |
|------|------|
| `host` | API 根地址，默认 `http://localhost:3000` |
| `token` | 登录后的会话 Cookie 值 |
| `username` / `role` / `userId` | 当前用户信息（登录后写入） |

连接自建或生产环境时，在登录时指定主机：

```bash
utmod auth login --host https://your-mods-hub.example.com
```

## 命令总览

```text
utmod
├── auth
│   ├── login [--host <url>]   # 浏览器 OAuth 式登录
│   ├── logout                 # 清除本地凭证
│   └── status                 # 查看登录状态
└── mod
    ├── list                   # 列出当前用户全部模组
    ├── view <id>              # 查看模组详情
    ├── create [options]       # 上传并创建模组
    ├── update <id> [options]  # 更新模组
    └── delete <id>            # 永久删除模组（需确认）
```

查看内置帮助：

```bash
utmod --help
utmod mod create --help
```

## 身份认证 (`auth`)

### 登录

```bash
utmod auth login
```

流程简述：

1. CLI 在本地 `52026` 端口启动临时回调服务；
2. 打开浏览器访问 Hub 登录页，完成登录后服务端将 token 回传到本地；
3. 校验通过后写入 `~/.utmod-config.json`。

若浏览器未自动打开，终端会打印可手动访问的 URL。

### 状态与登出

```bash
utmod auth status
utmod auth logout
```

未登录时执行 `mod` 子命令会提示先运行 `utmod auth login`。

## 模组管理 (`mod`)

上传与更新后模组会进入 **`pending`** 待审核状态；更新元数据或文件后可能需 **重新审核**（与 Web 端行为一致）。

### 列出模组

```bash
utmod mod list
```

### 查看详情

```bash
utmod mod view 12
```

### 创建模组

**交互式**（无参数时逐步提问）：

```bash
utmod mod create
```

**非交互式**示例：

```bash
utmod mod create \
  --title-zh "我的狙击枪 Mod" \
  --title-en "My Sniper Mod" \
  --desc-zh "简短说明" \
  --category weapon \
  --version 1.0.0 \
  --file ./dist/mod.zip \
  --cover ./cover.png \
  --tags-zh "武器,狙击" \
  --tags-en "weapon,sniper" \
  -y
```

#### `create` / `update` 常用选项

| 选项 | 说明 |
|------|------|
| `--title` | 标题（兼容：默认写入中文 `zh`） |
| `--title-zh` / `--title-en` | 中/英标题 |
| `--description` / `--desc-zh` / `--desc-en` | 简介 |
| `--body` / `--body-zh` / `--body-en` | 正文 Markdown；若值为已存在文件路径则读取文件内容 |
| `--category` | 分类 key，如 `weapon`、`map`、`vehicle`、`survival`、`ui`、`other` |
| `--version` | 版本号 |
| `--file` | 模组 ZIP 路径 |
| `--cover` | 封面图路径 |
| `--tags` | 标签（逗号分隔，兼容：默认 `zh`） |
| `--tags-zh` / `--tags-en` | 中/英标签（逗号分隔） |
| `--tags-json <path>` | 标签 JSON 文件，形如 `[{"zh":"…","en":"…"}, …]` |
| `--dependencies` | 依赖模组 ID，逗号分隔，如 `5,12` |
| `-y, --yes` | 跳过交互与确认（CI 常用；`create` 非交互时 `--title` 与 `--file` 必填） |

### 更新模组

```bash
utmod mod update 12 --version 1.1.0 --file ./mod_v1.1.0.zip -y
```

仅传需要修改的字段；无参数且未使用 `-y` 时进入交互式编辑。使用 `-y` 时通过各 `--*` 选项提交变更。

### 删除模组

```bash
utmod mod delete 12
```

终端会二次确认，操作不可恢复。

## 上传说明

CLI 会自动适配部署环境：

- **生产 / Worker + R2**：优先使用 `/api/upload/presign` 预签名上传，再以 JSON 创建模组；
- **本地开发**：预签名不可用时回退为 multipart 上传（`/api/upload/cover`、`/api/upload/mod-file` 等）。

因此同一套命令可对本地 `bun run dev` 与线上 Hub 使用（登录时 `--host` 指向对应地址即可）。

## 目录结构

```text
cli/
├── package.json          # 包名 utmod-cli，bin: utmod
├── tsconfig.json
└── src/
    ├── index.ts          # Commander 入口
    ├── config.ts         # ~/.utmod-config.json
    ├── api.ts            # HTTP、上传
    ├── commands/
    │   ├── auth.ts       # 浏览器登录回调
    │   └── mod.ts        # 模组 CRUD
    └── utils/            # 表格、提示、多语言与标签
```

## 开发

```bash
cd cli
bun install
bun run start
```

依赖：`commander`、`ora`、`prompts`、`picocolors`、`cli-table3`。

## 相关文档

- 仓库根目录 [README.md](../README.md) — 平台整体说明
- 创作中心 Web 文档：`client/src/docs/cli-guide.md` — 面向站内的 CLI 使用指南

## 常见问题

**命令找不到 `utmod`**

确认 `~/.bun/bin` 在 `PATH` 中；Windows 安装后请新开终端。

**HTTP 401 / Unauthorized**

运行 `utmod auth login`，或检查 `host` 是否指向正确的 Hub 地址。

**本地登录失败**

确保 Hub 服务已启动（默认 `http://localhost:3000`），且本机 `52026` 端口未被占用。