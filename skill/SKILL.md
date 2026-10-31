---
name: design-docs
description: Set up, deploy or maintain a repo's design-docs site (design-docs-kit) — Markdown pages with embedded HTML visuals in docs/, published as a VitePress site on Cloudflare Pages behind Cloudflare Access, read by agents through AGENTS.md and the design-docs MCP server. Use when the user wants design docs kept in the repo instead of Notion or a wiki, asks to set up, deploy or publish the docs site, to restrict who can read it, to migrate docs into it, or when you need to record or change a design decision in a repo that has a .design-docs.json.
---

# Design docs (design-docs-kit)

## Is the repo set up?

A repo is set up when `.design-docs.json` exists at its root. If it does, skip to **Deploying** or **Maintaining**.

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
6. Commit. To publish the site, continue with **Deploying**. GitHub MCP for clients without a checkout needs the user's own token: point them to `docs/guide/02-mcp.md`.

## Deploying

GitHub Actions builds the site and uploads it to Cloudflare Pages; Cloudflare Access lets only listed emails in. `docs/guide/03-deploy.md` is the reference for every step.

1. Run `npx -y design-docs-kit@latest deploy status` (or call the `docs_deploy_status` MCP tool). It checks each step — account, workflow, secret, latest run, Access, recorded address — and says what is next and who does it. Work through the steps it marks `todo`, in order; skip what is `done`. The same command covers all three starting points:
   - **No Cloudflare account**: the user signs up at dash.cloudflare.com/sign-up.
   - **Has an account**: the user signs in.
   - **Already deployed**: only the missing steps show up (often Access or the recorded address).
2. Steps marked `you` are the user's alone: signing up or in, passkeys and 2FA, payment cards (Zero Trust's Free plan asks for one), clicking **Create token**, and putting the token into the repository secret. Ask for each one and wait. Never type, read back or screenshot passwords or tokens, and never ask the user to paste a token into the chat: they run `gh secret set CLOUDFLARE_API_TOKEN --repo <owner/repo>` themselves.
3. Steps marked `agent+you` you can do in a browser the user has signed in to (a built-in browser or their own): fill in the API-token form up to its review page, create the Access policy and the self-hosted application. If you have no browser, give the user the clicks from the guide page.
4. Once the user is signed in, read the account id from the dashboard address (`dash.cloudflare.com/<32 hex>/…`) and run `npx -y design-docs-kit@latest deploy --account-id <id>`. Commit and push `.github/workflows/docs-site.yml` and `.design-docs.json`.
5. After the first successful run the site is **public until Access is set up**, so do the Access step straight away, and ask the user which emails to allow if they have not said.
6. Run `deploy` once more: it records `siteUrl` and refreshes the AGENTS.md section. Commit and push.

Repositories owned by a GitHub organization need nothing extra: setting a repository secret needs only admin rights on the repository, unlike Cloudflare's "Connect to Git", which needs an organization owner to approve its GitHub App.

## Maintaining

- Read `AGENTS.md` → "Design docs" and `docs/guide/01-maintaining.md` before editing.
- A decision changed → update the page that owns it, in the same change as the code.
- After editing: `npm --prefix docs run check`, then commit and push.
- To let someone in or out, edit the emails in the Cloudflare Access policy; nothing in the repo changes.
- `npx design-docs-kit@latest init` again upgrades the vendored kit files (`docs/.vitepress/kit/`) and re-syncs the AGENTS.md section; pages are left alone.
