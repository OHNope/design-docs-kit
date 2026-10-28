# AI 怎么读文档（MCP）

在本仓库里工作的 AI 直接读写 `__DOCS_DIR__/` 里的文件就行，不需要额外配置。下面两种 MCP 是给其他场合用的：本地的 `design-docs` 服务给出结构化的目录、搜索和写作规则；GitHub 官方 MCP 让没有本地仓库的 AI（比如 claude.ai 网页版）也能读到文档。

| 场合 | 用哪个 | 要配置吗 |
| --- | --- | --- |
| 在本仓库里用 Claude Code | 直接读文件；`design-docs` 已在 `.mcp.json` 里 | 第一次打开时批准一下 |
| 在本仓库里用 Cursor、Codex 等 | 直接读文件；`AGENTS.md` 写了规则 | 可选：加 `design-docs` |
| 在别的项目里想查这里的设计 | `design-docs`，指向本仓库的路径 | 要 |
| claude.ai 网页版、手机 App | GitHub 官方 MCP | 要 |

## design-docs：本地文档 MCP

它是仓库里的一个脚本（`__DOCS_DIR__/.vitepress/kit/mcp.mjs`），不需要安装依赖，只要有 Node 18 以上。提供四个工具：

| 工具 | 做什么 |
| --- | --- |
| `docs_overview` | 列出所有页面和每页的结论，附上「怎么维护文档」的规则。先调这个 |
| `docs_search` | 按关键词找到页面、小节和行号，中文日文都能搜 |
| `docs_read` | 读一页，或者只读其中一个小节 |
| `docs_check` | 运行文档检查，改完之后调 |

**在本仓库里（Claude Code）**：仓库根目录的 `.mcp.json` 已经配好，第一次打开项目时 Claude Code 会问要不要启用 `design-docs`，选同意即可。用 `/mcp` 可以看到它是否已连接。

**在本仓库里（Cursor）**：在 `.cursor/mcp.json` 里加：

```json
{
  "mcpServers": {
    "design-docs": { "command": "node", "args": ["__DOCS_DIR__/.vitepress/kit/mcp.mjs"] }
  }
}
```

**在别的项目里查这里的设计**：把脚本路径写成本仓库的绝对路径，例如 Claude Code：

```bash
claude mcp add design-docs -- node /你的路径/__REPO_NAME__/__DOCS_DIR__/.vitepress/kit/mcp.mjs
```

它读的是你本地这份仓库，所以先 `git pull` 才是最新内容。

## GitHub 官方 MCP：给没有本地仓库的 AI

GitHub 提供托管的 MCP 服务，地址是 `https://api.githubcopilot.com/mcp/`。AI 用你的 GitHub 权限读仓库里的文件，所以私有仓库也能读。

1. 在 GitHub 创建一个 fine-grained personal access token：Repository access 只选本仓库，Permissions 里只给 **Contents: Read-only**。组织的仓库可能需要组织管理员批准这个 token。
2. 不要把 token 写进仓库里的任何文件。
3. Claude Code（全局，所有项目可用）：

   ```bash
   claude mcp add --scope user --transport http github https://api.githubcopilot.com/mcp/ -H "Authorization: Bearer 你的token" -H "X-MCP-Readonly: true"
   ```

4. claude.ai 网页版：在 Settings → Connectors 里添加 GitHub（或用自定义 connector 填上面的地址），按提示用 GitHub 账号授权。
5. 让 AI 读文档时告诉它仓库和路径，例如：“读 __REPO_SLUG__ 仓库里 `__DOCS_DIR__/index.md`，按里面的阅读顺序找答案。”

GitHub MCP 的地址、请求头和授权方式可能会变，以 [github/github-mcp-server](https://github.com/github/github-mcp-server) 的说明为准。
