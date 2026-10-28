# 部署与访问控制

网站部署在 Cloudflare Pages，连着 GitHub 仓库，push 到 `__BRANCH__` 后约 1 分钟自动更新；用 Cloudflare Access 只放行指定的邮箱，别人打不开。两者都有免费额度，小团队通常够用，以 Cloudflare 当前的价格说明为准。

GitHub Pages 不适合放设计文档：免费计划下私有仓库开不了 Pages，付费计划下 Pages 站点也是公开的。

## 第一次上线

这些步骤在你自己的 Cloudflare 账号里操作。

1. 登录 Cloudflare，进入 **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
2. 授权 Cloudflare Pages 的 GitHub App，选中本仓库（私有仓库也可以；看不到的话，在 GitHub 的 Settings → Applications 里给这个 App 加上本仓库）。
3. 构建设置：

   | 项目 | 填什么 |
   | --- | --- |
   | Production branch | `__BRANCH__` |
   | Framework preset | VitePress（或 None） |
   | Root directory | `__DOCS_DIR__` |
   | Build command | `npm run build` |
   | Build output directory | `.vitepress/dist` |
   | 环境变量 | `NODE_VERSION` = `22` |

4. 保存并部署。完成后会得到 `项目名.pages.dev` 的地址。
5. 把这个地址告诉 AI，让它写进仓库根目录 `.design-docs.json` 的 `siteUrl`，这样 MCP 和首页都能给出网站链接。

## 只让指定的人访问

1. 在 Pages 项目里打开 **Settings** → **General**，点 **Enable access policy**。它会为 `*.pages.dev` 和预览地址建好 Access 应用。
2. 进入 **Zero Trust** → **Access** → **Applications**，打开刚建的应用，把策略改成：Action = Allow，Include = Emails，填上允许访问的邮箱。
3. 用无痕窗口打开网站确认：会先要求输入邮箱、收验证码，名单外的邮箱进不去。
4. 以后要加人或删人，只改这条策略里的邮箱。

如果绑定了自己的域名，要给这个域名也加一条 Access 策略，否则自定义域名不受保护。

## 构建失败怎么办

在 Cloudflare 的部署记录里看日志。最常见的是文档检查报 error（坏链接、嵌入文件不存在、文本里有双花括号），在本地运行 `npm --prefix __DOCS_DIR__ run check` 能看到同样的提示，修好再 push。
