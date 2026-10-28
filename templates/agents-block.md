## Design docs

The design docs are the Markdown pages in `__DOCS_DIR__/`, published as a site__SITE_NOTE__. They are the only source of truth for the design: do not keep design notes anywhere else (no Notion, wiki, PLAN.md or handoff copies).

- **Before changing behaviour**, read the relevant pages. Start at `__DOCS_DIR__/index.md` (reading order) and `__DOCS_DIR__/guide/01-maintaining.md` (what goes where and how to write it). The `design-docs` MCP server gives the same through `docs_overview`, `docs_search` and `docs_read`.
- **When a design decision changes**, update the page that owns it in the same change as the code. Use the "What goes where" table in `__DOCS_DIR__/guide/01-maintaining.md` to pick the page; add a page only when no page owns the topic.
- **Writing rules**: pages are written in __LANG_NAME__ for people; one topic per page; the first paragraph states the conclusion; delete outdated text instead of annotating it; link instead of copying.
- **Visuals** stay HTML: put the file in `__DOCS_DIR__/public/embeds/<name>.html` and embed it on its own line with `<Embed src="/embeds/<name>.html" title="..." />`. Never flatten a visual into text.
- **New pages**: `__DOCS_DIR__/<section>/<NN>-<slug>.md`, first line `# Title`. The sidebar is generated from the files (order = file name), so no config edit is needed.
- **Check** before committing: `npm --prefix __DOCS_DIR__ run check` (or the `docs_check` MCP tool). Errors fail the site build.
- **Sync**: a SessionStart hook fetches `origin/__BRANCH__` and fast-forwards `__BRANCH__` when that is safe; it never merges or rebases. If it reports that it could not fast-forward, commit or stash local work, `git pull --rebase origin __BRANCH__` and resolve conflicts with the user before touching the docs. On another branch or worktree, read the latest docs with `git show origin/__BRANCH__:__DOCS_DIR__/<page>.md`. After editing docs on `__BRANCH__`, commit and push so the site redeploys; on a feature branch the docs merge with the code.
