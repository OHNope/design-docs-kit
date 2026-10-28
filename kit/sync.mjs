#!/usr/bin/env node
// SessionStart hook: bring the docs up to date without ever creating a
// conflict. On the docs branch it fast-forwards when that is safe; otherwise
// it changes nothing and tells the agent (stdout goes into its context) what
// to do. On other branches it only fetches, so the latest docs can be read
// with `git show origin/<branch>:<docs>/<page>.md`.
// Usage: node sync.mjs <branch> <docsDir>
import { execFileSync } from 'node:child_process'

const [branch = 'main', docsDir = 'docs'] = process.argv.slice(2)
const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' }

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 }).trim()
}

function say(msg) {
  console.log(`design-docs-kit: ${msg}`)
}

try {
  try {
    git('fetch', '--quiet', 'origin', branch)
  } catch {
    say(`could not fetch origin/${branch} (offline or no access); the docs may be out of date.`)
    process.exit(0)
  }
  const current = git('branch', '--show-current')
  const behind = Number(git('rev-list', '--count', `HEAD..origin/${branch}`))
  if (current === branch) {
    if (behind === 0) process.exit(0)
    try {
      git('merge', '--ff-only', '--quiet', `origin/${branch}`)
      say(`pulled ${behind} new commit(s) from origin/${branch}.`)
    } catch {
      const ahead = Number(git('rev-list', '--count', `origin/${branch}..HEAD`))
      const why = ahead > 0 ? `local ${branch} has ${ahead} commit(s) not on origin` : 'uncommitted changes touch the same files'
      say(
        `origin/${branch} has ${behind} new commit(s) but could not be fast-forwarded (${why}). ` +
          `Before reading or editing ${docsDir}/: commit or stash local work, run \`git pull --rebase origin ${branch}\`, and resolve any conflicts with the user.`,
      )
    }
  } else if (behind > 0) {
    say(
      `this branch (${current || 'detached HEAD'}) is ${behind} commit(s) behind origin/${branch}. ` +
        `Read the latest docs with \`git show origin/${branch}:${docsDir}/<page>.md\`; docs changes made here reach ${branch} when the branch merges.`,
    )
  }
} catch {
  // Not a git repo or git missing: nothing to sync.
}
process.exit(0)
