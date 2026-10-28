# Deploy and access control

The site runs on Cloudflare Pages, connected to the GitHub repository; a push to `__BRANCH__` updates it in about a minute. Cloudflare Access lets in only the email addresses you list. Both have free tiers that usually cover a small team; check Cloudflare's current pricing.

GitHub Pages is a poor fit for design docs: on the free plan private repositories cannot use Pages, and on paid plans the Pages site is public.

## Going live

Do these steps in your own Cloudflare account.

1. In Cloudflare, open **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Authorize the Cloudflare Pages GitHub App and pick this repository (private works; if it is missing, add it to the app under GitHub Settings → Applications).
3. Build settings:

   | Setting | Value |
   | --- | --- |
   | Production branch | `__BRANCH__` |
   | Framework preset | VitePress (or None) |
   | Root directory | `__DOCS_DIR__` |
   | Build command | `npm run build` |
   | Build output directory | `.vitepress/dist` |
   | Environment variable | `NODE_VERSION` = `22` |

4. Save and deploy. You get a `project.pages.dev` address.
5. Ask the agent to put that address in `siteUrl` in `.design-docs.json` at the repo root, so the MCP server and pages can link to the site.

## Letting only your team in

1. In the Pages project, open **Settings** → **General** and click **Enable access policy**. This creates an Access application for `*.pages.dev` and preview deployments.
2. In **Zero Trust** → **Access** → **Applications**, open that application and set the policy: Action = Allow, Include = Emails, with the allowed addresses.
3. Check in a private window: the site asks for an email and a one-time code; addresses not on the list are refused.
4. To add or remove people later, edit the emails in that policy.

A custom domain needs its own Access policy; otherwise it is not protected.

## When the build fails

Read the log in Cloudflare's deployment list. The usual cause is a checker error (broken link, missing embed file, double curly braces in text); `npm --prefix __DOCS_DIR__ run check` shows the same messages locally.
