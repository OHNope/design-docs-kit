# 部署与访问控制

push 到 `__BRANCH__` 并且改了 `__DOCS_DIR__/` 时，GitHub Actions 会检查、构建网站，再上传到 Cloudflare Pages，大约 1 分钟后更新。网站前面有 Cloudflare Access，只有名单里的邮箱能打开。两者都有免费额度，小团队通常够用，以 Cloudflare 当前的价格说明为准。

运行 `npx design-docs-kit deploy status`（或者让 AI 调用 MCP 工具 `docs_deploy_status`）能看到做到哪一步了：每一步是否完成、下一步做什么、谁来做。不管是完全没有 Cloudflare 账号、已经有账号，还是网站已经上线，都从这里开始。

## 为什么这样部署

- **不用 GitHub Pages**：免费计划下私有仓库开不了 Pages，付费计划下 Pages 站点也是公开的。
- **不用 Cloudflare 的「Connect to Git」**：它要在仓库上安装 Cloudflare 的 GitHub App。仓库属于组织时只有组织所有者能批准，批准时还要 passkey 或两步验证。GitHub Actions 只需要一个仓库 secret，仓库管理员就能设置。

## 第一次上线

「你」指只有本人能做的事：注册、登录、passkey、绑卡、复制密钥。其余的 AI 都能做；标着「AI 用浏览器」的步骤，AI 可以在你已经登录的浏览器里操作。

| 步骤 | 谁来做 | 做什么 |
| --- | --- | --- |
| 1. Cloudflare 账号 | 你 | 没有账号：在 [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) 注册（邮箱、Google 或 GitHub 都行）。已有账号：登录。账号 ID 是控制台网址里那段 32 位十六进制，`dash.cloudflare.com/<账号 ID>/…`。 |
| 2. 工作流 | AI | `npx design-docs-kit deploy --account-id <账号 ID>` 会写好 `.github/workflows/docs-site.yml`，并把账号记进 `.design-docs.json`。两个文件都提交并 push。 |
| 3. API token | 你（AI 用浏览器填表） | **Manage account** → **Account API tokens** → **Create Token** → **Start from scratch**：Entire account，**Cloudflare Pages: Edit**，不过期。由你点 **Create token** 并复制，token 只显示一次。不要把 token 贴进聊天。 |
| 4. 仓库 secret | 你（仓库管理员） | 运行 `gh secret set CLOUDFLARE_API_TOKEN --repo __REPO_SLUG__`，在提示处粘贴 token。也可以在 GitHub 的 Settings → Secrets and variables → Actions 里添加。 |
| 5. 第一次部署 | AI | `gh workflow run docs-site.yml --repo __REPO_SLUG__`，或者 push 一次文档改动。之后 `deploy status` 会给出网址，通常是 `<项目名>.pages.dev`。做完第 6 步之前**网站是公开的**，所以紧接着做第 6 步。 |
| 6. Access | 第一次由你，之后 AI 用浏览器 | 第一次进 **Zero Trust** 要起团队名、选 Free 计划，Free 计划也要绑卡。然后：**Access controls** → **Policies** → **Add a policy**：Action 选 Allow，Include 选 Emails，填允许访问的邮箱。**Access controls** → **Applications** → **Create new application** → **Self-hosted**：Public hostname 切到自定义输入，填 `<项目名>.pages.dev` 和 `*.<项目名>.pages.dev`，挂上这条策略，点 **Create**。 |
| 7. 确认 | AI | `deploy status` 显示网站要求 Access 登录。用无痕窗口打开：先要输入邮箱、收验证码；名单外的邮箱收不到验证码。 |
| 8. 记下网址 | AI | 再运行一次 `npx design-docs-kit deploy`，它会把 `siteUrl` 写进 `.design-docs.json`，MCP 和 AGENTS.md 里的规则就能指向网站。提交并 push。 |

## 加人或删人

在 Access 策略里改邮箱（**Zero Trust** → **Access controls** → **Policies**），马上生效，仓库里不用改。

绑定了自己的域名时，要把这个域名也加进 Access 应用，否则自定义域名不受保护。

## 换 token

按第 3 步新建一个 token，再运行一次第 4 步的命令，然后在 Cloudflare 里删掉旧的。

## 部署失败怎么办

`deploy status` 会给出失败那次运行的链接，`gh run view <运行 ID> --log-failed` 能看日志。最常见的是文档检查报 error（坏链接、嵌入文件不存在、文本里有双花括号）；本地运行 `npm --prefix __DOCS_DIR__ run check` 能看到同样的提示。
