#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { init } from '../src/init.mjs'
import { runCheck } from '../kit/check.mjs'
import { serve } from '../kit/mcp.mjs'
import { setupDeploy } from '../src/deploy.mjs'
import { deployStatus, findRoot, formatStatus } from '../kit/deploy.mjs'

const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../package.json'), 'utf8'))

const HELP = `design-docs-kit ${pkg.version}

Usage:
  design-docs-kit init [options]   Set up (or upgrade) the docs site in the current git repo
  design-docs-kit check [dir]      Check the docs pages (default: the folder in .design-docs.json)
  design-docs-kit mcp [dir]        Run the design-docs MCP server on stdio
  design-docs-kit deploy [options] Write the GitHub Actions workflow that publishes the site
                                   to Cloudflare Pages, then show what is left to do
  design-docs-kit deploy status    Only show the deploy status: each step, the next action, who does it

Options for init:
  --dir <path>      Docs folder, relative to the repo root (default: docs)
  --lang <code>     Site language: zh-CN, ja or en (default: en)
  --title <text>    Site title (default: the repo folder name)
  --branch <name>   Branch the site deploys from (default: the repo's default branch)
  --site-url <url>  Published site address, once deployed
  --force           Also overwrite .vitepress/config.mjs and the theme files
  --no-install      Skip npm install in the docs folder
  --dry-run         Print what would change, write nothing

Options for deploy:
  --account-id <id> Cloudflare account id (32 hex characters, from the dashboard URL)
  --project <name>  Cloudflare Pages project name (default: <repo>-docs)
  --dry-run         Print what would change, write nothing
`

function parseArgs(argv) {
  const opts = { _: [] }
  const flags = { '--force': 'force', '--dry-run': 'dryRun', '--strict': 'strict' }
  const values = {
    '--dir': 'dir',
    '--lang': 'lang',
    '--title': 'title',
    '--branch': 'branch',
    '--site-url': 'siteUrl',
    '--account-id': 'accountId',
    '--project': 'project',
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const [key, inline] = a.split(/=(.*)/s)
    if (flags[a]) opts[flags[a]] = true
    else if (a === '--no-install') opts.install = false
    else if (values[key]) {
      const v = inline ?? argv[++i]
      if (v === undefined) throw new Error(`${key} needs a value`)
      opts[values[key]] = v
    } else if (a.startsWith('--')) throw new Error(`Unknown option ${a}`)
    else opts._.push(a)
  }
  return opts
}

function docsDirFrom(arg) {
  if (arg) return resolve(arg)
  let dir = process.cwd()
  for (;;) {
    const f = join(dir, '.design-docs.json')
    if (existsSync(f)) return join(dir, JSON.parse(readFileSync(f, 'utf8')).dir ?? 'docs')
    const up = dirname(dir)
    if (up === dir) return resolve('docs')
    dir = up
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') return console.log(HELP)
  if (cmd === '--version' || cmd === '-v') return console.log(pkg.version)
  const opts = parseArgs(rest)
  if (cmd === 'init') {
    const res = init(opts)
    const width = Math.max(...res.actions.map((a) => a.action.length))
    for (const a of res.actions) console.log(`${a.action.padEnd(width)}  ${a.path}`)
    if (res.pagesLang !== res.config.lang) console.log(`\nNo ${res.config.lang} page templates yet; guide pages were written in English.`)
    if (opts.dryRun) return console.log('\nDry run: nothing was written.')
    console.log(`
Next:
  1. Fill in "What goes where" in ${res.config.dir}/guide/01-maintaining.md for this project.
  2. Preview: npm --prefix ${res.config.dir} run dev
  3. Deploy: design-docs-kit deploy status, then follow ${res.config.dir}/guide/03-deploy.md.`)
    return
  }
  if (cmd === 'check') {
    process.exitCode = runCheck(docsDirFrom(opts._[0]), { strict: opts.strict }) ? 0 : 1
    return
  }
  if (cmd === 'mcp') return serve(docsDirFrom(opts._[0]))
  if (cmd === 'deploy' && opts._[0] === 'status') return console.log(formatStatus(await deployStatus(findRoot(process.cwd()))))
  if (cmd === 'deploy') {
    if (opts._.length) throw new Error(`Unknown deploy argument "${opts._[0]}"`)
    const res = await setupDeploy(opts)
    const width = Math.max(...res.actions.map((a) => a.action.length))
    for (const a of res.actions) console.log(`${a.action.padEnd(width)}  ${a.path}`)
    if (opts.dryRun) return console.log('\nDry run: nothing was written.')
    console.log('\n' + formatStatus(res.status))
    return
  }
  throw new Error(`Unknown command "${cmd}". Run design-docs-kit --help.`)
}

main().catch((e) => {
  console.error(`design-docs-kit: ${e.message}`)
  process.exitCode = 1
})
