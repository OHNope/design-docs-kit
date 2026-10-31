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
- **A docs MCP server** (`design-docs`) in `.mcp.json`: `docs_overview`, `docs_search`, `docs_read`, `docs_check`, `docs_deploy_status`.
- **A checker** that fails the build on broken links, missing embeds and text that breaks the Vue compiler.
- **A Claude Code SessionStart hook** that brings the docs up to date without ever creating a conflict (details below).
- **Deployment** to Cloudflare Pages through GitHub Actions, with Cloudflare Access letting in only the emails you list (details below).
- **Guide pages** in `docs/guide/`: maintaining the docs, configuring MCP clients (including GitHub's MCP server for clients without a checkout), and deploying.

Everything the site needs at runtime is copied into `docs/.vitepress/kit/` with no dependencies besides VitePress, so the repo does not depend on this package after `init`. Run `init` again to upgrade those files; it never overwrites your pages.

## Why

Notion and wikis are pleasant for people but awkward for agents: rate limits, truncated pages, plan limits, and a second place that drifts from the code. A docs folder in the repo is free, versioned with the code, readable by any agent, and — with a static site in front — still pleasant for people to review.

## Commands

| Command | What it does |
| --- | --- |
| `design-docs-kit init` | Set up or upgrade the current repo. Options: `--dir`, `--lang zh-CN\|ja\|en`, `--title`, `--branch`, `--site-url`, `--force` (also overwrite config and theme), `--no-install`, `--dry-run` |
| `design-docs-kit check [dir]` | Check the pages; exits 1 on errors (`--strict`: also on warnings) |
| `design-docs-kit mcp [dir]` | Run the MCP server on stdio |
| `design-docs-kit deploy` | Write the GitHub Actions workflow that publishes the site, record the Cloudflare account and, once deployed, the site address. Options: `--account-id`, `--project`, `--dry-run` |
| `design-docs-kit deploy status` | Show each deploy step: done or not, the next action and who does it |

Inside a set-up repo the same tools run without this package: `npm --prefix docs run check`, `npm --prefix docs run deploy-status`, `node docs/.vitepress/kit/mcp.mjs`.

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

`deploy` adds `.github/workflows/docs-site.yml` and a `cloudflare` entry (account id, Pages project) in `.design-docs.json`.

## The sync hook

Two people and their agents edit the same docs, so a session should start from the latest version — but a hook must never leave the repo in a half-merged state. On session start, `kit/sync.mjs`:

- fetches `origin/<branch>`;
- on `<branch>`, fast-forwards only when that is safe; if local commits or uncommitted changes are in the way it changes nothing and tells the agent (hook output goes into its context) to commit or stash, rebase and resolve conflicts with the user;
- on any other branch or worktree, only reports how far behind it is and how to read the latest docs with `git show origin/<branch>:docs/<page>.md`.

## Deploying

On every push that touches the docs, GitHub Actions checks and builds the site and uploads it to Cloudflare Pages with `wrangler`; Cloudflare Access in front of it lets in only the email addresses you list. Both are free for a small team.

Actions rather than Cloudflare's "Connect to Git" because the latter needs the Cloudflare GitHub App on the repository, which for an organization's repository only an owner can approve. A repository secret needs only admin rights on the repository.

`deploy status` (or the `docs_deploy_status` MCP tool) checks every step and says who does the next one, so the same flow works whether you have no Cloudflare account yet, already have one, or are already deployed:

| Step | Who |
| --- | --- |
| Cloudflare account (sign up or sign in) | You |
| `design-docs-kit deploy --account-id <id>`, commit, push | Agent |
| API token with "Cloudflare Pages: Edit" | You click Create and copy it; an agent can fill in the form in your signed-in browser |
| `gh secret set CLOUDFLARE_API_TOKEN` | You |
| First deploy | Agent |
| Zero Trust Free plan (asks for a card), Access policy and application | You once; then an agent in your signed-in browser |
| Record the address: `design-docs-kit deploy` again | Agent |

The agent never types, reads or stores passwords and tokens. The steps are spelled out in the generated `docs/guide/03-deploy.md`.

## Skill

`skill/SKILL.md` is a Claude Code skill. `init` installs it into the repo; to use it before a repo is set up, copy it to `~/.claude/skills/design-docs/SKILL.md`.

## Requirements

Node 18.17 or later and git. Deploying needs a Cloudflare account, admin rights on the GitHub repository and, for `deploy status`, the [GitHub CLI](https://cli.github.com).

## License

MIT
