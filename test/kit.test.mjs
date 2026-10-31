import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { PassThrough } from 'node:stream'
import { checkDocs, listPageFiles, parsePage, readSection, searchDocs, resolvePage } from '../kit/lib.mjs'
import { buildSidebar } from '../kit/sidebar.mjs'
import { searchTokenize } from '../kit/ui.mjs'
import { createHandlers, handleMessage, serve } from '../kit/mcp.mjs'
import { init, upsertBlock, mergeSettings } from '../src/init.mjs'
import { setupDeploy } from '../src/deploy.mjs'
import { pagesProjectName, siteFromDeployLog, classifyAccess, formatStatus } from '../kit/deploy.mjs'

function docsFixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'ddk-'))
  for (const [p, text] of Object.entries(files)) {
    mkdirSync(join(dir, p, '..'), { recursive: true })
    writeFileSync(join(dir, p), text)
  }
  return dir
}

const SAMPLE = {
  'index.md': '# Home\n\nThe answer first.\n\n- [Runtime](./baseline/06-runtime.md)\n',
  'baseline/index.md': '# 设计基线\n\n::: info\n这是当前有效的设计。\n:::\n',
  'baseline/10-decisions.md': '# 10 决定记录\n\n按日期记下的决定。\n\n## 否决的方案\n\n不用 Rust。\n\n## 其他\n\n略。\n',
  'baseline/06-runtime.md': '# 6 运行时与稳定性\n\n租约默认 60 秒，心跳续约。\n\n```js\nconst a = {{ b }}\n```\n\n<Embed src="/embeds/rt.html" title="图解" />\n',
  'public/embeds/rt.html': '<!doctype html><p>hi</p>',
}

test('pages are listed index first, then by file name with numeric order', () => {
  const dir = docsFixture(SAMPLE)
  assert.deepEqual(listPageFiles(dir), ['index.md', 'baseline/index.md', 'baseline/06-runtime.md', 'baseline/10-decisions.md'])
})

test('summary is the first paragraph, including container text', () => {
  assert.equal(parsePage(SAMPLE['baseline/index.md']).summary, '这是当前有效的设计。')
  assert.equal(parsePage(SAMPLE['index.md']).summary, 'The answer first.')
})

test('sidebar groups folders under their index page', () => {
  const dir = docsFixture(SAMPLE)
  const sb = buildSidebar(dir)
  assert.deepEqual(sb[0], { text: 'Home', link: '/' })
  assert.equal(sb[1].text, '设计基线')
  assert.equal(sb[1].link, '/baseline/')
  assert.deepEqual(sb[1].items.map((i) => i.link), ['/baseline/06-runtime', '/baseline/10-decisions'])
})

test('check passes a clean site and ignores code blocks', () => {
  const dir = docsFixture(SAMPLE)
  const res = checkDocs(dir)
  assert.deepEqual(res.errors, [])
  assert.equal(res.pages, 4)
})

test('check reports broken links, missing embeds, braces and missing titles', () => {
  const dir = docsFixture({
    'index.md': '# Home\n\nSee [gone](./nope.md) and {{ x }}.\n\n<Embed src="/embeds/missing.html" />\n',
    'untitled.md': 'no title here\n',
    'inline.md': '# Inline\n\nVue reads `{{ y }}` even in inline code.\n',
    'public/embeds/orphan.html': '<p></p>',
  })
  const { errors, warnings } = checkDocs(dir)
  assert.equal(errors.length, 5, errors.join('\n'))
  assert.ok(errors.some((e) => e.startsWith('inline.md:3')))
  assert.ok(errors.some((e) => e.includes('broken link: ./nope.md')))
  assert.ok(errors.some((e) => e.includes('embed not found')))
  assert.ok(errors.some((e) => e.includes('{{')))
  assert.ok(errors.some((e) => e.startsWith('untitled.md:1')))
  assert.ok(warnings.some((w) => w.includes('orphan.html')))
})

test('search matches CJK substrings and every term', () => {
  const dir = docsFixture(SAMPLE)
  const hits = searchDocs(dir, '租约 心跳')
  assert.equal(hits.length, 1)
  assert.equal(hits[0].path, 'baseline/06-runtime.md')
  assert.equal(hits[0].line, 3)
  assert.equal(searchDocs(dir, '租约 不存在').length, 0)
})

test('readSection returns one section and resolvePage stays inside the docs folder', () => {
  const sec = readSection(SAMPLE['baseline/10-decisions.md'], '否决')
  assert.equal(sec, '## 否决的方案\n\n不用 Rust。')
  const dir = docsFixture(SAMPLE)
  assert.equal(resolvePage(dir, 'baseline/10-decisions'), 'baseline/10-decisions.md')
  assert.equal(resolvePage(dir, 'baseline'), 'baseline/index.md')
  assert.equal(resolvePage(dir, '../../etc/passwd'), null)
})

test('search tokenizer indexes CJK character pairs', () => {
  assert.deepEqual(searchTokenize('流程引擎 v2'), ['流程', '程引', '引擎', 'v2'])
})

test('MCP server answers initialize, tools/list and tools/call over stdio', async () => {
  const dir = docsFixture(SAMPLE)
  const input = new PassThrough()
  const output = new PassThrough()
  const lines = []
  output.on('data', (d) => lines.push(...d.toString().split('\n').filter(Boolean)))
  serve(dir, input, output)
  const send = (m) => input.write(JSON.stringify(m) + '\n')
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } })
  send({ jsonrpc: '2.0', method: 'notifications/initialized' })
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
  send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'docs_read', arguments: { path: 'baseline/10-decisions.md', heading: '否决' } } })
  await new Promise((r) => setTimeout(r, 50))
  const res = lines.map((l) => JSON.parse(l))
  assert.equal(res.length, 3)
  assert.equal(res[0].result.protocolVersion, '2025-06-18')
  assert.deepEqual(res[1].result.tools.map((t) => t.name), ['docs_overview', 'docs_search', 'docs_read', 'docs_check', 'docs_deploy_status'])
  assert.match(res[2].result.content[0].text, /不用 Rust/)
})

test('MCP overview lists pages with summaries; unknown pages are errors', async () => {
  const h = createHandlers(docsFixture(SAMPLE))
  assert.match(h.docs_overview().content[0].text, /baseline\/06-runtime\.md — 6 运行时与稳定性: 租约默认 60 秒/)
  assert.equal(h.docs_read({ path: 'nope.md' }).isError, true)
  assert.equal((await handleMessage(h, { jsonrpc: '2.0', id: 9, method: 'nope' })).error.code, -32601)
})

test('AGENTS.md block is replaced in place, not duplicated', () => {
  const once = upsertBlock('# AGENTS.md\n\nOther rules.\n', 'v1')
  const twice = upsertBlock(once, 'v2')
  assert.equal(twice.match(/design-docs-kit:start/g).length, 1)
  assert.match(twice, /Other rules\.[\s\S]*v2/)
  assert.doesNotMatch(twice, /v1/)
})

test('settings merge keeps other hooks and adds the pull hook once', () => {
  const base = { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'other' }] }] }, enabledMcpjsonServers: ['x'] }
  const a = mergeSettings(base, 'main', 'docs')
  const b = mergeSettings(a, 'main', 'docs')
  assert.equal(b.hooks.SessionStart.length, 2)
  assert.equal(b.hooks.SessionStart[0].hooks[0].command, 'other')
  assert.match(b.hooks.SessionStart[1].hooks[0].command, /kit\/sync\.mjs" "main" "docs"/)
  assert.deepEqual(b.enabledMcpjsonServers, ['x', 'design-docs'])
})

test('sync hook fast-forwards when safe and only reports otherwise', () => {
  const base = mkdtempSync(join(tmpdir(), 'ddk-sync-'))
  const g = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  const sync = (cwd) =>
    execFileSync('node', [join(import.meta.dirname, '../kit/sync.mjs'), 'main', 'docs'], { cwd, encoding: 'utf8' }).trim()
  g(base, 'init', '-q', '--bare', '-b', 'main', 'origin.git')
  const commit = (cwd, file, text, msg) => {
    writeFileSync(join(cwd, file), text)
    g(cwd, 'add', file)
    g(cwd, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', msg)
  }
  g(base, 'clone', '-q', 'origin.git', 'a')
  const a = join(base, 'a')
  commit(a, 'page.md', 'v1\n', 'v1')
  g(a, 'push', '-q', 'origin', 'main')
  g(base, 'clone', '-q', 'origin.git', 'b')
  const b = join(base, 'b')

  commit(a, 'page.md', 'v2\n', 'v2')
  g(a, 'push', '-q', 'origin', 'main')
  assert.match(sync(b), /pulled 1 new commit/)
  assert.equal(readFileSync(join(b, 'page.md'), 'utf8'), 'v2\n')
  assert.equal(sync(b), '')

  commit(a, 'page.md', 'v3\n', 'v3')
  g(a, 'push', '-q', 'origin', 'main')
  commit(b, 'other.md', 'mine\n', 'local')
  assert.match(sync(b), /could not be fast-forwarded \(local main has 1 commit/)
  assert.equal(readFileSync(join(b, 'page.md'), 'utf8'), 'v2\n')

  g(b, 'checkout', '-q', '-b', 'feature')
  assert.match(sync(b), /behind origin\/main[\s\S]*git show origin\/main:docs/)
})

test('init sets up a repo, keeps existing pages and is idempotent', () => {
  const root = mkdtempSync(join(tmpdir(), 'ddk-repo-'))
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root })
  writeFileSync(join(root, 'AGENTS.md'), '# AGENTS.md\n\nKeep me.\n')
  mkdirSync(join(root, 'docs'))
  writeFileSync(join(root, 'docs/index.md'), '# Mine\n\nAlready here.\n')
  const first = init({ cwd: root, lang: 'zh-CN', title: '测试', install: false })
  assert.equal(first.config.dir, 'docs')
  assert.equal(readFileSync(join(root, 'docs/index.md'), 'utf8'), '# Mine\n\nAlready here.\n')
  assert.ok(existsSync(join(root, 'docs/.vitepress/kit/mcp.mjs')))
  assert.match(readFileSync(join(root, 'docs/.vitepress/config.mjs'), 'utf8'), /title: "测试"/)
  assert.match(readFileSync(join(root, 'AGENTS.md'), 'utf8'), /Keep me\.[\s\S]*## Design docs/)
  assert.equal(readFileSync(join(root, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n')
  assert.equal(JSON.parse(readFileSync(join(root, '.mcp.json'), 'utf8')).mcpServers['design-docs'].command, 'node')
  assert.match(readFileSync(join(root, 'docs/guide/01-maintaining.md'), 'utf8'), /# 怎么维护文档/)
  const second = init({ cwd: root, install: false })
  assert.deepEqual(second.actions.filter((a) => a.action === 'updated' || a.action === 'created'), [])
  assert.equal(second.config.lang, 'zh-CN')
  const check = checkDocs(join(root, 'docs'))
  assert.deepEqual(check.errors, [])
})

test('check accepts Markdown autolinks but still flags raw tags', () => {
  const dir = docsFixture({ 'index.md': '# Home\n\nSee <https://example.com/a?b=1> or <team@example.com>.\n\nA <custom> tag.\n' })
  const { warnings } = checkDocs(dir)
  assert.equal(warnings.length, 1, warnings.join('\n'))
  assert.match(warnings[0], /index\.md:5 raw <custom> tag/)
})

test('deploy helpers: project names, the address in the deploy log, Access detection', () => {
  assert.equal(pagesProjectName('Meta_Workflow'), 'meta-workflow-docs')
  assert.equal(pagesProjectName('设计'), 'design-docs')
  const log = 'deploy\tDeploy\t2026-10-31T03:55:05Z ✨ Deployment complete! Take a peek over at https://41012cfc.meta-workflow-docs-a1b.pages.dev'
  assert.equal(siteFromDeployLog(log), 'https://meta-workflow-docs-a1b.pages.dev')
  assert.equal(siteFromDeployLog('nothing here'), null)
  assert.equal(classifyAccess(302, 'https://team.cloudflareaccess.com/cdn-cgi/access/login/x'), 'protected')
  assert.equal(classifyAccess(302, 'https://elsewhere.example/'), 'redirect')
  assert.equal(classifyAccess(200, null), 'public')
  assert.equal(classifyAccess(404, null), 'missing')
  const text = formatStatus({ site: null, steps: [{ id: 'account', state: 'todo', text: 'No account', next: 'Sign up', who: 'you' }] })
  assert.match(text, /\[todo\] account: No account\n\s+next \(you\): Sign up[\s\S]*Next step: account \(you\)/)
})

test('deploy writes the workflow, keeps the config and reports the remaining steps', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ddk-deploy-'))
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root })
  init({ cwd: root, lang: 'en', title: 'T', install: false })
  await assert.rejects(setupDeploy({ cwd: root, accountId: 'nope' }), /not a Cloudflare account id/)
  const id = '0123456789abcdef0123456789abcdef'
  await assert.rejects(setupDeploy({ cwd: root, accountId: id }), /package-lock\.json is missing/)
  writeFileSync(join(root, 'docs/package-lock.json'), '{}\n')
  const res = await setupDeploy({ cwd: root, accountId: id, project: 'my-docs' })
  const wf = readFileSync(join(root, '.github/workflows/docs-site.yml'), 'utf8')
  assert.match(wf, /CLOUDFLARE_ACCOUNT_ID: 0123456789abcdef0123456789abcdef/)
  assert.match(wf, /PAGES_PROJECT: my-docs/)
  assert.match(wf, /- "docs\/\*\*"/)
  assert.match(wf, /\$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/)
  assert.doesNotMatch(wf, /__[A-Z_]+__/)
  const config = JSON.parse(readFileSync(join(root, '.design-docs.json'), 'utf8'))
  assert.deepEqual(config.cloudflare, { accountId: id, project: 'my-docs' })
  assert.deepEqual(res.status.steps.map((s) => [s.id, s.state]), [
    ['account', 'done'],
    ['workflow', 'todo'],
    ['secret', 'unknown'],
    ['run', 'unknown'],
    ['access', 'unknown'],
    ['site-url', 'todo'],
  ])
  init({ cwd: root, install: false })
  assert.deepEqual(JSON.parse(readFileSync(join(root, '.design-docs.json'), 'utf8')).cloudflare, config.cloudflare)
})
