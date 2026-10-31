#!/usr/bin/env node
// Deploy status of the docs site: GitHub Actions builds it and uploads it to
// Cloudflare Pages, and Cloudflare Access lets only listed emails in. Each
// step reports whether it is done, what to do next and who does it.
// This file is copied into <docs>/.vitepress/kit/ by `design-docs-kit init`,
// so it must stay dependency-free.
// Usage: node deploy.mjs [repoRoot]   (default: the repo this file sits in)
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const WORKFLOW_PATH = '.github/workflows/docs-site.yml'
export const WORKFLOW_NAME = 'docs-site.yml'
export const SECRET_NAME = 'CLOUDFLARE_API_TOKEN'

function run(cmd, args, cwd) {
  try {
    const out = execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 })
    return { ok: true, out: out.trim() }
  } catch (e) {
    return { ok: false, out: String(e.stdout ?? '').trim(), err: String(e.stderr || e.message).trim().split('\n')[0] }
  }
}

export function readConfig(root) {
  const f = join(root, '.design-docs.json')
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {}
}

// The repo root: the nearest folder above `start` that has .design-docs.json.
export function findRoot(start) {
  for (let dir = resolve(start); ; dir = dirname(dir)) {
    if (existsSync(join(dir, '.design-docs.json'))) return dir
    if (dirname(dir) === dir) return resolve(start)
  }
}

export function repoSlug(root) {
  const remote = run('git', ['remote', 'get-url', 'origin'], root).out
  const m = remote.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/)
  return m ? `${m[1]}/${m[2]}` : null
}

// Lowercase letters, digits and dashes, as Cloudflare Pages project names allow.
export function pagesProjectName(repoName) {
  const base = String(repoName || 'design')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${(base || 'design').slice(0, 52).replace(/-+$/, '')}-docs`
}

// wrangler ends a deploy with "Take a peek over at https://<hash>.<site>.pages.dev".
// <site> is usually the project name, but Cloudflare adds a suffix when the
// name is taken, so the address is read from the log rather than guessed.
export function siteFromDeployLog(log) {
  const hits = [...String(log).matchAll(/Take a peek over at https:\/\/[a-z0-9]+\.([a-z0-9-]+)\.pages\.dev/gi)]
  return hits.length ? `https://${hits.at(-1)[1]}.pages.dev` : null
}

// How the site answers a request without a login.
export function classifyAccess(status, location) {
  if (status >= 300 && status < 400 && location) {
    try {
      if (new URL(location).hostname.endsWith('.cloudflareaccess.com')) return 'protected'
    } catch {}
    return 'redirect'
  }
  if (status >= 200 && status < 300) return 'public'
  return 'missing'
}

async function probe(url) {
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) })
    return classifyAccess(res.status, res.headers.get('location'))
  } catch {
    return 'unreachable'
  }
}

// who: "you" = only the person can do it (sign-up, sign-in, payment card,
// copying a secret); "agent" = an agent with a shell can do it; "agent+you"
// = an agent can do it in a browser the person has signed in to.
export async function deployStatus(root) {
  const config = readConfig(root)
  const branch = config.branch ?? 'main'
  const cf = config.cloudflare ?? {}
  const slug = repoSlug(root)
  const steps = []
  const add = (id, done, text, next, who) => steps.push({ id, state: done === null ? 'unknown' : done ? 'done' : 'todo', text, next, who })

  add(
    'account',
    Boolean(cf.accountId),
    cf.accountId ? `Cloudflare account ${cf.accountId}` : 'No Cloudflare account recorded',
    'Sign up at https://dash.cloudflare.com/sign-up or sign in; the account id is the 32-character hex part of the dashboard URL. Then run: npx design-docs-kit deploy --account-id <id>',
    'you',
  )

  const hasFile = existsSync(join(root, WORKFLOW_PATH))
  run('git', ['fetch', '-q', 'origin', branch], root)
  const pushed = run('git', ['cat-file', '-e', `origin/${branch}:${WORKFLOW_PATH}`], root).ok
  add(
    'workflow',
    hasFile && pushed,
    !hasFile ? `${WORKFLOW_PATH} is missing` : pushed ? `${WORKFLOW_PATH} is on origin/${branch}` : `${WORKFLOW_PATH} is not on origin/${branch} yet`,
    !hasFile ? 'Run: npx design-docs-kit deploy --account-id <id>' : `Commit ${WORKFLOW_PATH} and push it to ${branch}`,
    'agent',
  )

  const gh = slug ? run('gh', ['secret', 'list', '--repo', slug], root) : { ok: false, err: 'origin is not a GitHub repository' }
  const hasSecret = gh.ok ? gh.out.split('\n').some((l) => l.split(/\s/)[0] === SECRET_NAME) : null
  add(
    'secret',
    hasSecret,
    hasSecret ? `Repository secret ${SECRET_NAME} is set` : gh.ok ? `Repository secret ${SECRET_NAME} is not set` : `Cannot list repository secrets (${gh.err})`,
    `Create an account API token with "Cloudflare Pages: Edit" (Cloudflare → Manage account → Account API tokens), then run: gh secret set ${SECRET_NAME} --repo ${slug ?? '<owner/repo>'} and paste it. Never paste the token into a chat.`,
    'you',
  )

  let site = null
  const runs = slug ? run('gh', ['run', 'list', '--repo', slug, '--workflow', WORKFLOW_NAME, '--limit', '1', '--json', 'databaseId,status,conclusion,url'], root) : { ok: false }
  const last = runs.ok ? JSON.parse(runs.out || '[]')[0] : undefined
  if (!runs.ok || !last) {
    add('run', runs.ok ? false : null, runs.ok ? 'The workflow has not run yet' : 'Cannot list workflow runs', `Push a docs change to ${branch}, or run: gh workflow run ${WORKFLOW_NAME} --repo ${slug ?? '<owner/repo>'}`, 'agent')
  } else if (last.status !== 'completed') {
    add('run', false, `Latest run is ${last.status}: ${last.url}`, `Wait for it: gh run watch ${last.databaseId} --repo ${slug}`, 'agent')
  } else if (last.conclusion !== 'success') {
    add('run', false, `Latest run ended with ${last.conclusion}: ${last.url}`, `Read the log: gh run view ${last.databaseId} --repo ${slug} --log-failed`, 'agent')
  } else {
    const log = run('gh', ['run', 'view', String(last.databaseId), '--repo', slug, '--log'], root)
    site = siteFromDeployLog(log.out)
    add('run', true, `Latest run succeeded: ${last.url}`, '', 'agent')
  }
  site ??= config.siteUrl ?? null

  const access = site ? await probe(site) : null
  const project = (site && new URL(site).hostname.replace(/\.pages\.dev$/, '')) || cf.project || '<project>'
  add(
    'access',
    access === null || access === 'unreachable' || access === 'missing' ? null : access === 'protected',
    !site
      ? 'Site address unknown until the first successful deploy'
      : access === 'protected'
        ? `${site} asks for a Cloudflare Access login`
        : access === 'public'
          ? `${site} is PUBLIC: anyone can read it`
          : `${site} answered ${access}`,
    `In Cloudflare Zero Trust: create a policy (Allow, Include: Emails) and a self-hosted application for ${project}.pages.dev and *.${project}.pages.dev with that policy`,
    'agent+you',
  )

  add(
    'site-url',
    Boolean(site) && config.siteUrl === site,
    config.siteUrl ? `siteUrl is ${config.siteUrl}` : 'siteUrl is not recorded in .design-docs.json',
    site ? 'Run: npx design-docs-kit deploy (it records the address)' : 'Deploy first',
    'agent',
  )
  return { site, steps }
}

export function formatStatus({ site, steps }) {
  const out = []
  for (const s of steps) {
    out.push(`[${s.state}] ${s.id}: ${s.text}`)
    if (s.state !== 'done' && s.next) out.push(`         next (${s.who}): ${s.next}`)
  }
  const todo = steps.find((s) => s.state !== 'done')
  out.push('', todo ? `Next step: ${todo.id} (${todo.who})` : `Deployed and protected: ${site}`)
  return out.join('\n')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv.slice(2).find((a) => !a.startsWith('--'))
  console.log(formatStatus(await deployStatus(dir ? resolve(dir) : findRoot(dirname(fileURLToPath(import.meta.url))))))
}
