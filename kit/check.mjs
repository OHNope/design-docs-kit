#!/usr/bin/env node
// Checks the docs pages: titles, links, embeds, Vue-breaking text.
// Usage: node check.mjs [docsDir]   (default: the docs folder this file sits in)
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkDocs } from './lib.mjs'

export function runCheck(docsDir, { strict = false, log = console.log } = {}) {
  const { pages, errors, warnings } = checkDocs(docsDir)
  for (const e of errors) log(`error   ${e}`)
  for (const w of warnings) log(`warning ${w}`)
  log(`${pages} pages, ${errors.length} errors, ${warnings.length} warnings`)
  return errors.length === 0 && (!strict || warnings.length === 0)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const strict = args.includes('--strict')
  const dir = args.find((a) => !a.startsWith('--'))
  const docsDir = dir ? resolve(dir) : resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  process.exit(runCheck(docsDir, { strict }) ? 0 : 1)
}
