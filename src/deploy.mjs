// `design-docs-kit deploy`: writes the GitHub Actions workflow that publishes
// the docs site to Cloudflare Pages, records the Cloudflare account and
// project in .design-docs.json, and, once a deploy has succeeded, the site
// address. Safe to re-run at any stage; `deploy status` only reports.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { init, detectRepo, readJson, fill } from './init.mjs'
import { WORKFLOW_PATH, pagesProjectName, deployStatus } from '../kit/deploy.mjs'

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export async function setupDeploy(opts = {}) {
  const repo = detectRepo(resolve(opts.cwd ?? process.cwd()))
  const root = repo.root
  const configFile = join(root, '.design-docs.json')
  if (!existsSync(configFile)) throw new Error('No .design-docs.json here; run design-docs-kit init first')
  const config = readJson(configFile, {})
  const accountId = opts.accountId ?? config.cloudflare?.accountId
  if (accountId && !/^[0-9a-f]{32}$/.test(accountId)) throw new Error(`"${accountId}" is not a Cloudflare account id (32 hex characters)`)
  const project = opts.project ?? config.cloudflare?.project ?? pagesProjectName(repo.slug?.split('/')[1] ?? basename(root))
  if (!/^[a-z0-9][a-z0-9-]{0,57}$/.test(project)) throw new Error(`"${project}" is not a valid Pages project name (lowercase letters, digits, dashes)`)

  const lock = `${config.dir ?? 'docs'}/package-lock.json`
  if (accountId && !existsSync(join(root, lock))) throw new Error(`${lock} is missing; run npm install in ${config.dir ?? 'docs'} and commit the lock file (the workflow installs with npm ci)`)

  const actions = []
  const write = (path, content) => {
    const abs = join(root, path)
    const exists = existsSync(abs)
    if (exists && readFileSync(abs, 'utf8') === content) return actions.push({ path, action: 'unchanged' })
    actions.push({ path, action: exists ? 'updated' : 'created' })
    if (opts.dryRun) return
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }

  if (accountId) {
    config.cloudflare = { accountId, project }
    const vars = { BRANCH: config.branch ?? 'main', DOCS_DIR: config.dir ?? 'docs', ACCOUNT_ID: accountId, PROJECT: project }
    write(WORKFLOW_PATH, fill(readFileSync(join(PKG_ROOT, 'templates/github/docs-site.yml'), 'utf8'), vars))
  }
  write('.design-docs.json', JSON.stringify(config, null, 2) + '\n')
  const status = opts.dryRun ? null : await deployStatus(root)
  if (status?.site && config.siteUrl !== status.site) {
    // init records the address and puts it into the AGENTS.md section.
    for (const a of init({ cwd: root, siteUrl: status.site, install: false }).actions) {
      if (a.action === 'updated' || a.action === 'created') actions.push(a)
    }
    config.siteUrl = status.site
    status.steps.find((s) => s.id === 'site-url').state = 'done'
  }
  return { root, config, actions: actions.filter((a, i) => actions.findLastIndex((b) => b.path === a.path) === i), status }
}
