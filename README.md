# design-docs-kit

Keep a project's design docs in its git repo, where people review them as a website and AI agents read and update them as files.

```bash
npx design-docs-kit init --lang en --title "My project design"
# or straight from GitHub:
npx github:OHNope/design-docs-kit init --lang en --title "My project design"
```

One command turns the current repo into this setup:

- **A docs site** in `docs/`: Markdown pages, HTML visuals embedded with `<Embed src="/embeds/x.html" />`, a sidebar generated from the files, and search that works for Chinese and Japanese. Built with [VitePress](https://vitepress.dev).
- **Rules for agents** in `AGENTS.md` (and `@AGENTS.md` in `CLAUDE.md`): the docs are the only source of truth, which page owns which topic, how to write, and how to sync.
- **A docs MCP server** (`design-docs`) in `.mcp.json`: `docs_overview`, `docs_search`, `docs_read`, `docs_check`.
- **A checker** that fails the build on broken links, missing embeds and text that breaks the Vue compiler.
- **A Claude Code SessionStart hook** that brings the docs up to date without ever creating a conflict (details below).
- **Guide pages** in `docs/guide/`: maintaining the docs, configuring MCP clients (including GitHub's MCP server for clients without a checkout), and deploying to Cloudflare Pages with Cloudflare Access.

Everything the site needs at runtime is copied into `docs/.vitepress/kit/` with no dependencies besides VitePress, so the repo does not depend on this package after `init`. Run `init` again to upgrade those files; it never overwrites your pages.

## Why

Notion and wikis are pleasant for people but awkward for agents: rate limits, truncated pages, plan limits, and a second place that drifts from the code. A docs folder in the repo is free, versioned with the code, readable by any agent, and — with a static site in front — still pleasant for people to review.

## Commands

| Command | What it does |
| --- | --- |
| `design-docs-kit init` | Set up or upgrade the current repo. Options: `--dir`, `--lang zh-CN\|ja\|en`, `--title`, `--branch`, `--site-url`, `--force` (also overwrite config and theme), `--no-install`, `--dry-run` |
| `design-docs-kit check [dir]` | Check the pages; exits 1 on errors (`--strict`: also on warnings) |
| `design-docs-kit mcp [dir]` | Run the MCP server on stdio |

Inside a set-up repo the same tools run without this package: `npm --prefix docs run check`, `node docs/.vitepress/kit/mcp.mjs`.

## What `init` writes

| Path | |
| --- | --- |
| `.design-docs.json` | Docs folder, language, title, branch, site URL |
| `docs/.vitepress/` | Site config, theme with the `Embed` component, vendored kit (`kit/`) |
| `docs/package.json` | `dev`, `check`, `build` (check + build), `preview` scripts |
| `docs/index.md`, `docs/guide/*.md` | Starter pages, only if missing |
| `AGENTS.md`, `CLAUDE.md` | A "Design docs" section between `design-docs-kit` markers; the rest of the file is untouched |
| `.claude/settings.json` | The SessionStart sync hook, merged with your hooks |
| `.mcp.json` | The `design-docs` server, merged with your servers |
| `.claude/skills/design-docs/SKILL.md` | A Claude Code skill for setting up and maintaining the docs |
| `.gitignore` | `docs/node_modules/`, build output and cache |

## The sync hook

Two people and their agents edit the same docs, so a session should start from the latest version — but a hook must never leave the repo in a half-merged state. On session start, `kit/sync.mjs`:

- fetches `origin/<branch>`;
- on `<branch>`, fast-forwards only when that is safe; if local commits or uncommitted changes are in the way it changes nothing and tells the agent (hook output goes into its context) to commit or stash, rebase and resolve conflicts with the user;
- on any other branch or worktree, only reports how far behind it is and how to read the latest docs with `git show origin/<branch>:docs/<page>.md`.

## Skill

`skill/SKILL.md` is a Claude Code skill. `init` installs it into the repo; to use it before a repo is set up, copy it to `~/.claude/skills/design-docs/SKILL.md`.

## Requirements

Node 18.17 or later and git. Deploying and GitHub MCP need your own Cloudflare and GitHub accounts; the guide pages walk through them.

## License

MIT
