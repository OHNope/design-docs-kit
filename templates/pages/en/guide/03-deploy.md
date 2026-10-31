# Deploy and access control

On every push to `__BRANCH__` that touches `__DOCS_DIR__/`, GitHub Actions checks and builds the site and uploads it to Cloudflare Pages; it is live about a minute later. Cloudflare Access in front of it lets in only the email addresses you list. Both have free tiers that usually cover a small team; check Cloudflare's current pricing.

`npx design-docs-kit deploy status` (or the `docs_deploy_status` MCP tool) shows how far you have got: each step, whether it is done, the next action and who does it. Start there whether you have no Cloudflare account yet, already have one, or the site is already live.

## Why this setup

- **Not GitHub Pages**: on the free plan private repositories cannot use Pages, and on paid plans the Pages site is public.
- **Not Cloudflare's "Connect to Git"**: it needs the Cloudflare GitHub App installed on the repository. For a repository owned by an organization only an owner can approve that, and the approval asks for a passkey or 2FA. GitHub Actions needs only a repository secret, which any repository admin can set.

## Going live

"You" are steps only a person can do: sign-up, sign-in, passkeys, payment cards, and copying secrets. An agent can do the rest; the steps marked "agent in browser" it can do in a browser you have signed in to.

| Step | Who | What |
| --- | --- | --- |
| 1. Cloudflare account | You | No account: sign up at [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) (email, Google or GitHub). Have one: sign in. The account id is the 32-character hex part of the dashboard address, `dash.cloudflare.com/<account id>/…`. |
| 2. Workflow | Agent | `npx design-docs-kit deploy --account-id <id>` writes `.github/workflows/docs-site.yml` and records the account in `.design-docs.json`. Commit and push both. |
| 3. API token | You (agent in browser fills the form) | **Manage account** → **Account API tokens** → **Create Token** → **Start from scratch**: Entire account, **Cloudflare Pages: Edit**, no expiration. You click **Create token** and copy it; Cloudflare shows it only once. Never paste a token into a chat. |
| 4. Repository secret | You (repository admin) | `gh secret set CLOUDFLARE_API_TOKEN --repo __REPO_SLUG__`, paste the token at the prompt. Or GitHub → Settings → Secrets and variables → Actions. |
| 5. First deploy | Agent | `gh workflow run docs-site.yml --repo __REPO_SLUG__`, or push a docs change. `deploy status` then shows the address, usually `<project>.pages.dev`. Until step 6 is done **the site is public**, so do it right away. |
| 6. Access | You once, then agent in browser | First time in **Zero Trust** you pick a team name and the Free plan, which asks for a payment card. Then: **Access controls** → **Policies** → **Add a policy**: Action Allow, Include Emails, the allowed addresses. **Access controls** → **Applications** → **Create new application** → **Self-hosted**: public hostnames (switch to custom input) `<project>.pages.dev` and `*.<project>.pages.dev`, attach the policy, **Create**. |
| 7. Check | Agent | `deploy status` reports that the site asks for an Access login. In a private window the site asks for an email and a one-time code; addresses not on the list get no code. |
| 8. Record the address | Agent | `npx design-docs-kit deploy` again saves `siteUrl` in `.design-docs.json`, so the MCP server and the agent rules point to the site. Commit and push. |

## Adding or removing people

Edit the emails in the Access policy (**Zero Trust** → **Access controls** → **Policies**). It takes effect at once; nothing in the repository changes.

A custom domain must be added to the Access application as well; otherwise it is not protected.

## Rotating the token

Create a new token as in step 3, run the command in step 4 again, then delete the old token in Cloudflare.

## When the deploy fails

`deploy status` links the failed run; `gh run view <id> --log-failed` shows the log. The usual cause is a checker error (broken link, missing embed file, double curly braces in text); `npm --prefix __DOCS_DIR__ run check` shows the same messages locally.
