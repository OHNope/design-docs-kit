# How AI reads the docs (MCP)

Agents working in this repository read and edit the files in `__DOCS_DIR__/` directly; nothing to set up. The two MCP servers below are for other situations: the local `design-docs` server gives a structured page list, search and the writing rules; GitHub's MCP server lets an AI without a checkout (such as claude.ai) read the docs.

| Situation | Use | Setup |
| --- | --- | --- |
| Claude Code in this repo | Files directly; `design-docs` is in `.mcp.json` | Approve it once |
| Cursor, Codex etc. in this repo | Files directly; rules in `AGENTS.md` | Optional: add `design-docs` |
| Another project that needs this design | `design-docs`, pointed at this repo | Yes |
| claude.ai web or mobile | GitHub MCP | Yes |

## design-docs: the local docs server

It is a script in the repo (`__DOCS_DIR__/.vitepress/kit/mcp.mjs`) with no dependencies; it needs Node 18 or later. Tools:

| Tool | What it does |
| --- | --- |
| `docs_overview` | Lists every page with its conclusion, plus the maintenance rules. Call first |
| `docs_search` | Finds page, section and line by keywords; works for CJK text |
| `docs_read` | Reads a page, or one section of it |
| `docs_check` | Runs the docs checker; call after editing |

**Claude Code in this repo**: `.mcp.json` at the repo root already lists it. Claude Code asks once whether to enable `design-docs`; approve it. `/mcp` shows whether it is connected.

**Cursor in this repo**: add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "design-docs": { "command": "node", "args": ["__DOCS_DIR__/.vitepress/kit/mcp.mjs"] }
  }
}
```

**From another project**: use the absolute path of this repo's script, e.g. in Claude Code:

```bash
claude mcp add design-docs -- node /path/to/__REPO_NAME__/__DOCS_DIR__/.vitepress/kit/mcp.mjs
```

It reads your local checkout, so `git pull` first to get the latest docs.

## GitHub MCP: for an AI without a checkout

GitHub hosts an MCP server at `https://api.githubcopilot.com/mcp/`. The AI reads repository files with your GitHub permissions, so private repositories work.

1. Create a fine-grained personal access token: Repository access = this repository only; Permissions = **Contents: Read-only**. An organization may need to approve the token.
2. Never write the token into any file in the repository.
3. Claude Code (user scope, every project):

   ```bash
   claude mcp add --scope user --transport http github https://api.githubcopilot.com/mcp/ -H "Authorization: Bearer YOUR_TOKEN" -H "X-MCP-Readonly: true"
   ```

4. claude.ai: add GitHub under Settings → Connectors (or a custom connector with the address above) and authorize with your GitHub account.
5. Tell the AI the repository and path, e.g. "Read `__DOCS_DIR__/index.md` in __REPO_SLUG__ and follow its reading order."

The address, headers and sign-in flow may change; [github/github-mcp-server](https://github.com/github/github-mcp-server) is the reference.
