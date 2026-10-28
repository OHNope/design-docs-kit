---
name: design-docs
description: Set up or maintain a repo's design-docs site (design-docs-kit) — Markdown pages with embedded HTML visuals in docs/, published as a VitePress site, read by agents through AGENTS.md and the design-docs MCP server. Use when the user wants design docs kept in the repo instead of Notion or a wiki, asks to set up the docs site, to migrate docs into it, or when you need to record or change a design decision in a repo that has a .design-docs.json.
---

# Design docs (design-docs-kit)

## Is the repo set up?

A repo is set up when `.design-docs.json` exists at its root. If it does, skip to **Maintaining**.

## Setting up

1. Ask the user only what you cannot infer: the site language (`zh-CN`, `ja` or `en`) and the site title. The docs folder defaults to `docs`; the branch defaults to the repo's default branch.
2. Run from the repo root:

   ```bash
   npx -y design-docs-kit@latest init --lang <lang> --title "<title>"
   ```

   If the npm package is not available, use `npx -y github:OHNope/design-docs-kit init ...` instead.

   It writes `docs/` (VitePress site, guide pages, vendored checker and MCP server), `.design-docs.json`, the "Design docs" section of `AGENTS.md` (and `@AGENTS.md` in `CLAUDE.md`), a SessionStart hook in `.claude/settings.json` that pulls the default branch, the `design-docs` server in `.mcp.json`, and `.gitignore` entries; then runs `npm install` in the docs folder. It never overwrites pages that already exist. `--dry-run` lists what it would do.
3. Fill in the "What goes where" table in `docs/guide/01-maintaining.md` for this project's folders. This table is how future agents decide which page to update, so make it concrete.
4. If the user has existing docs (Notion, Google Docs, a wiki), migrate them page by page into Markdown, keeping the text verbatim. HTML visuals go to `docs/public/embeds/` and are embedded with `<Embed src="/embeds/<name>.html" title="..." />` — never flattened into text.
5. Run `npm --prefix docs run check` and `npm --prefix docs run build`; fix every error.
6. Commit. Deployment (Cloudflare Pages + Access) and GitHub MCP need the user's own accounts and tokens: point them to `docs/guide/03-deploy.md` and `docs/guide/02-mcp.md` instead of doing it for them.

## Maintaining

- Read `AGENTS.md` → "Design docs" and `docs/guide/01-maintaining.md` before editing.
- A decision changed → update the page that owns it, in the same change as the code.
- After editing: `npm --prefix docs run check`, then commit and push.
- `npx design-docs-kit@latest init` again upgrades the vendored kit files (`docs/.vitepress/kit/`) and re-syncs the AGENTS.md section; pages are left alone.
