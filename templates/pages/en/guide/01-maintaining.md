# Maintaining the docs

Design docs live only in the repository's `__DOCS_DIR__/` folder; push to `__BRANCH__` and the site updates. People and AI agents follow the rules below; agents start from `AGENTS.md` at the repository root, which points here.

## What goes where

<!-- Adapt this table to your folders; agents use it to decide which page to change. -->

| Content | Where |
| --- | --- |
| Home: list of docs and reading order | `index.md` |
| How to use and maintain this site | `guide/` |

## How to write

- One topic per page. The first paragraph states the conclusion; when the content changes, update it.
- Delete outdated text instead of annotating it ("previously ..."). Git keeps the history.
- Say each thing in one place and link to it from elsewhere; do not copy.
- Write for people in plain words; put versions, paths and numbers meant for AI at the end of the page.

## Adding a page

1. Create `NN-name.md` in the right folder, starting with `# Title`. The sidebar is sorted by file name; use `01-`, `02-` prefixes to set the order.
2. A new folder gets an `index.md`; its title is the group name in the sidebar.
3. Link pages with relative links, e.g. `[Runtime](./06-runtime.md)`.

## Adding a visual (HTML)

1. Put the HTML file in `__DOCS_DIR__/public/embeds/name.html`.
2. On its own line in the page: `<Embed src="/embeds/name.html" title="Visual title" />`; add `height="900"` to change the height.
3. Keep visuals as HTML; do not flatten them into text or screenshots. Next to the embed, say in a few sentences what it shows, for readers and agents that cannot see it.

## Checking and syncing

- Run the checker after editing: `npm --prefix __DOCS_DIR__ run check`. Fix every error before committing; the site build runs the same check and fails on errors.
- Preview locally: `npm --prefix __DOCS_DIR__ run dev` and open the address it prints.
- Sync: when a Claude Code session starts, it fetches `origin/__BRANCH__` and fast-forwards when that is safe. If local commits or uncommitted changes are in the way, it changes nothing and tells the agent to deal with them first, so it never creates a conflict by itself. On a feature branch it only fetches; the agent reads the latest docs with `git show origin/__BRANCH__:__DOCS_DIR__/page.md`.
- The agent commits and pushes when it is done. For a small manual fix, use "Edit this page on GitHub" on the site.
- If two people edited the same page, git reports a conflict; resolve it together with the agent.
