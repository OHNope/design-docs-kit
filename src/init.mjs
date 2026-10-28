// `design-docs-kit init`: turns the current git repo into a design-docs site.
// Safe to re-run: it refreshes the vendored kit files and the AGENTS.md
// section, merges config files, and never overwrites existing pages.
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { join, dirname, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const KIT_FILES = ['lib.mjs', 'sidebar.mjs', 'ui.mjs', 'check.mjs', 'mcp.mjs', 'sync.mjs']
const THEME_FILES = ['index.mjs', 'Embed.vue', 'custom.css']
const GUIDE_PAGES = ['index.md', '01-maintaining.md', '02-mcp.md', '03-deploy.md']
const VITEPRESS_VERSION = '^1.6.4'
const BLOCK_START = '<!-- design-docs-kit:start -->'
const BLOCK_END = '<!-- design-docs-kit:end -->'
const HOOK_MARK = '# design-docs-kit'
const LANG_NAMES = { 'zh-CN': 'Chinese (Simplified)', ja: 'Japanese', en: 'English' }

function git(cwd, ...args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

export function detectRepo(cwd) {
  const root = git(cwd, 'rev-parse', '--show-toplevel') || cwd
  const originHead = git(root, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD')
  const branch = originHead.replace(/^origin\//, '') || git(root, 'branch', '--show-current') || 'main'
  const remote = git(root, 'remote', 'get-url', 'origin')
  const m = remote.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/)
  return { root, branch, slug: m ? `${m[1]}/${m[2]}` : null }
}

function readJson(file, fallback) {
  if (!existsSync(file)) return fallback
  const text = readFileSync(file, 'utf8')
  try {
    return JSON.parse(text)
  } catch (e) {
    throw new Error(`${file} is not valid JSON (${e.message}); fix it and run init again`)
  }
}

export function hookCommand(branch, dir) {
  return `node "$CLAUDE_PROJECT_DIR/${dir}/.vitepress/kit/sync.mjs" "${branch}" "${dir}" ${HOOK_MARK}`
}

export function upsertBlock(text, block) {
  const wrapped = `${BLOCK_START}\n${block.trim()}\n${BLOCK_END}`
  const start = text.indexOf(BLOCK_START)
  const end = text.indexOf(BLOCK_END)
  if (start >= 0 && end > start) return text.slice(0, start) + wrapped + text.slice(end + BLOCK_END.length)
  return (text.trimEnd() ? text.trimEnd() + '\n\n' : '') + wrapped + '\n'
}

export function mergeSettings(settings, branch, dir) {
  const out = structuredClone(settings)
  out.hooks ??= {}
  out.hooks.SessionStart ??= []
  const entries = out.hooks.SessionStart
  const command = hookCommand(branch, dir)
  const existing = entries.flatMap((e) => e.hooks ?? []).find((h) => String(h.command ?? '').includes(HOOK_MARK))
  if (existing) existing.command = command
  else entries.push({ matcher: 'startup|resume', hooks: [{ type: 'command', command, timeout: 30 }] })
  if (Array.isArray(out.enabledMcpjsonServers) && !out.enabledMcpjsonServers.includes('design-docs')) {
    out.enabledMcpjsonServers.push('design-docs')
  }
  return out
}

export function mergeDocsPackage(pkg, title) {
  const out = structuredClone(pkg)
  out.name ??= 'design-docs'
  out.private = true
  out.type ??= 'module'
  out.description ??= `Design docs site: ${title}`
  out.scripts = {
    dev: 'vitepress dev',
    check: 'node .vitepress/kit/check.mjs',
    build: 'node .vitepress/kit/check.mjs && vitepress build',
    preview: 'vitepress preview',
    ...out.scripts,
  }
  out.devDependencies = { vitepress: VITEPRESS_VERSION, ...out.devDependencies }
  return out
}

function fill(text, vars) {
  return text.replace(/__([A-Z_]+)__/g, (m, k) => (k in vars ? vars[k] : m))
}

export function init(opts = {}) {
  const cwd = resolve(opts.cwd ?? process.cwd())
  const repo = detectRepo(cwd)
  const root = repo.root
  const configFile = join(root, '.design-docs.json')
  const prev = readJson(configFile, {})
  const config = {
    dir: opts.dir ?? prev.dir ?? 'docs',
    lang: opts.lang ?? prev.lang ?? 'en',
    title: opts.title ?? prev.title ?? basename(root),
    branch: opts.branch ?? prev.branch ?? repo.branch,
    ...(prev.siteUrl || opts.siteUrl ? { siteUrl: opts.siteUrl ?? prev.siteUrl } : {}),
  }
  const dir = config.dir.replace(/\/+$/, '')
  const docs = join(root, dir)
  const pagesLang = existsSync(join(PKG_ROOT, 'templates/pages', config.lang)) ? config.lang : 'en'
  const vars = {
    TITLE: config.title,
    DOCS_DIR: dir,
    BRANCH: config.branch,
    LANG: config.lang,
    LANG_NAME: LANG_NAMES[config.lang] ?? config.lang,
    REPO_NAME: basename(root),
    REPO_SLUG: repo.slug ?? basename(root),
    SITE_NOTE: config.siteUrl ? ` at ${config.siteUrl}` : '',
  }
  const actions = []
  const write = (path, content, { overwrite = true } = {}) => {
    const abs = join(root, path)
    const exists = existsSync(abs)
    if (exists && !overwrite) return actions.push({ path, action: 'kept' })
    if (exists && readFileSync(abs, 'utf8') === content) return actions.push({ path, action: 'unchanged' })
    actions.push({ path, action: exists ? 'updated' : 'created' })
    if (opts.dryRun) return
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }
  const tmpl = (p) => readFileSync(join(PKG_ROOT, p), 'utf8')

  write('.design-docs.json', JSON.stringify(config, null, 2) + '\n')

  // Vendored runtime: always refreshed so re-running init upgrades it.
  for (const f of KIT_FILES) write(`${dir}/.vitepress/kit/${f}`, tmpl(`kit/${f}`))

  const editPattern = repo.slug ? `https://github.com/${repo.slug}/edit/${config.branch}/${dir}/:path` : ''
  const siteConfig = tmpl('templates/vitepress/config.mjs')
    .replace(`'__TITLE__'`, JSON.stringify(config.title))
    .replace(`'__LANG__'`, JSON.stringify(config.lang))
    .replace(`'__EDIT_PATTERN__'`, JSON.stringify(editPattern))
  write(`${dir}/.vitepress/config.mjs`, siteConfig, { overwrite: Boolean(opts.force) })
  for (const f of THEME_FILES) {
    write(`${dir}/.vitepress/theme/${f}`, tmpl(`templates/vitepress/theme/${f}`), { overwrite: Boolean(opts.force) })
  }

  const pkgFile = join(docs, 'package.json')
  write(`${dir}/package.json`, JSON.stringify(mergeDocsPackage(readJson(pkgFile, {}), config.title), null, 2) + '\n')

  write(`${dir}/index.md`, fill(tmpl(`templates/pages/${pagesLang}/index.md`), vars), { overwrite: false })
  for (const f of GUIDE_PAGES) {
    write(`${dir}/guide/${f}`, fill(tmpl(`templates/pages/${pagesLang}/guide/${f}`), vars), { overwrite: false })
  }
  if (!existsSync(join(docs, 'public/embeds'))) write(`${dir}/public/embeds/.gitkeep`, '')

  const agentsFile = join(root, 'AGENTS.md')
  const agents = existsSync(agentsFile) ? readFileSync(agentsFile, 'utf8') : '# AGENTS.md\n'
  write('AGENTS.md', upsertBlock(agents, fill(tmpl('templates/agents-block.md'), vars)))

  const claudeFile = join(root, 'CLAUDE.md')
  const claude = existsSync(claudeFile) ? readFileSync(claudeFile, 'utf8') : ''
  if (!/^@AGENTS\.md\s*$/m.test(claude)) write('CLAUDE.md', (claude.trimEnd() ? claude.trimEnd() + '\n\n' : '') + '@AGENTS.md\n')
  else actions.push({ path: 'CLAUDE.md', action: 'unchanged' })

  const settingsFile = join(root, '.claude/settings.json')
  write('.claude/settings.json', JSON.stringify(mergeSettings(readJson(settingsFile, {}), config.branch, dir), null, 2) + '\n')

  const mcpFile = join(root, '.mcp.json')
  const mcp = readJson(mcpFile, {})
  mcp.mcpServers ??= {}
  mcp.mcpServers['design-docs'] ??= { command: 'node', args: [`${dir}/.vitepress/kit/mcp.mjs`] }
  write('.mcp.json', JSON.stringify(mcp, null, 2) + '\n')

  write('.claude/skills/design-docs/SKILL.md', tmpl('skill/SKILL.md'))

  const ignoreFile = join(root, '.gitignore')
  const ignore = existsSync(ignoreFile) ? readFileSync(ignoreFile, 'utf8') : ''
  const want = [`${dir}/node_modules/`, `${dir}/.vitepress/dist/`, `${dir}/.vitepress/cache/`]
  const missing = want.filter((l) => !ignore.split(/\r?\n/).includes(l))
  if (missing.length) write('.gitignore', (ignore.trimEnd() ? ignore.trimEnd() + '\n' : '') + missing.join('\n') + '\n')
  else actions.push({ path: '.gitignore', action: 'unchanged' })

  let installed = false
  if (opts.install !== false && !opts.dryRun) {
    execFileSync('npm', ['install', '--no-fund', '--no-audit'], { cwd: docs, stdio: opts.quiet ? 'ignore' : 'inherit' })
    installed = true
  }
  return { root, config, actions, installed, pagesLang }
}
