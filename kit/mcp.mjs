#!/usr/bin/env node
// A dependency-free MCP server (stdio, JSON-RPC 2.0, one message per line)
// that lets an AI client list, search, read and check the design docs.
// Usage: node mcp.mjs [docsDir]   (default: the docs folder this file sits in)
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { listPages, resolvePage, readPageFile, readSection, searchDocs, checkDocs } from './lib.mjs'

const SERVER = { name: 'design-docs', version: '0.1.0' }
const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']
const GUIDE_PAGE = 'guide/01-maintaining.md'

function findConfig(docsDir) {
  let dir = docsDir
  for (let i = 0; i < 6; i++) {
    const f = join(dir, '.design-docs.json')
    if (existsSync(f)) {
      try {
        return JSON.parse(readFileSync(f, 'utf8'))
      } catch {
        return {}
      }
    }
    const up = dirname(dir)
    if (up === dir) break
    dir = up
  }
  return {}
}

const TOOLS = [
  {
    name: 'docs_overview',
    description:
      'Start here. Lists every design-docs page (path, title, one-line conclusion) and returns the maintenance rules: where each kind of content belongs and how to write it. Call before reading or changing the design docs.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'docs_search',
    description:
      'Find lines in the design docs that contain every space-separated term (case-insensitive substring match, works for Chinese and Japanese). Returns page path, section heading, line number and the line.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Terms separated by spaces, e.g. "租约 心跳"' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'docs_read',
    description:
      'Read one design-docs page as Markdown, or only one section of it. Paths are relative to the docs folder, as docs_overview and docs_search print them (e.g. "baseline/06-runtime.md").',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Page path, e.g. "handoff/u09-engine.md"' },
        heading: { type: 'string', description: 'Optional: return only the section whose heading contains this text' },
      },
      required: ['path'],
      additionalProperties: false,
    },
  },
  {
    name: 'docs_check',
    description:
      'Run the docs checker (titles, broken links, missing embeds, text that breaks the site build). Call after editing pages; errors must be fixed before committing.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
]

export function createHandlers(docsDir) {
  const config = findConfig(docsDir)
  const text = (t) => ({ content: [{ type: 'text', text: t }] })
  const fail = (t) => ({ content: [{ type: 'text', text: t }], isError: true })
  return {
    docs_overview() {
      const pages = listPages(docsDir)
      const lines = []
      if (config.siteUrl) lines.push(`Site: ${config.siteUrl}`)
      lines.push(`Docs folder: ${config.dir ?? 'docs'}/ (paths below are relative to it)`, '', '## Pages', '')
      for (const p of pages) lines.push(`- ${p.path} — ${p.title}${p.summary ? `: ${p.summary}` : ''}`)
      const guide = resolvePage(docsDir, GUIDE_PAGE)
      if (guide) lines.push('', `## Maintenance rules (${GUIDE_PAGE})`, '', readPageFile(docsDir, guide))
      return text(lines.join('\n'))
    },
    docs_search({ query, limit = 10 } = {}) {
      const hits = searchDocs(docsDir, query, Math.min(Number(limit) || 10, 50))
      if (!hits.length) return text(`No line contains all of: ${query}`)
      return text(hits.map((h) => `${h.path}:${h.line} [${h.title} › ${h.heading}]\n  ${h.text}`).join('\n'))
    },
    docs_read({ path, heading } = {}) {
      const page = resolvePage(docsDir, path)
      if (!page) return fail(`No page "${path}". Call docs_overview for the list of pages.`)
      const body = readSection(readPageFile(docsDir, page), heading)
      if (body === null) return fail(`No heading containing "${heading}" in ${page}.`)
      return text(`<!-- ${page} -->\n${body}`)
    },
    docs_check() {
      const { pages, errors, warnings } = checkDocs(docsDir)
      const out = [`${pages} pages, ${errors.length} errors, ${warnings.length} warnings`]
      for (const e of errors) out.push(`error   ${e}`)
      for (const w of warnings) out.push(`warning ${w}`)
      return text(out.join('\n'))
    },
  }
}

export function handleMessage(handlers, msg) {
  const { id, method, params } = msg
  const reply = (result) => ({ jsonrpc: '2.0', id, result })
  const error = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } })
  if (id === undefined || id === null) return null // notification
  switch (method) {
    case 'initialize': {
      const asked = params?.protocolVersion
      return reply({
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: {} },
        serverInfo: SERVER,
        instructions:
          'Design docs for this project. Call docs_overview first: it lists the pages and the rules for where content belongs. Pages are Markdown files in the repo; when you have the repo checked out, edit the files directly and run docs_check afterwards.',
      })
    }
    case 'ping':
      return reply({})
    case 'tools/list':
      return reply({ tools: TOOLS })
    case 'tools/call': {
      const fn = handlers[params?.name]
      if (!fn) return error(-32602, `Unknown tool: ${params?.name}`)
      try {
        return reply(fn(params.arguments ?? {}))
      } catch (e) {
        return reply({ content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true })
      }
    }
    default:
      return error(-32601, `Method not found: ${method}`)
  }
}

export function serve(docsDir, input = process.stdin, output = process.stdout) {
  const handlers = createHandlers(docsDir)
  const rl = createInterface({ input, crlfDelay: Infinity })
  rl.on('line', (line) => {
    if (!line.trim()) return
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      output.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n')
      return
    }
    const res = handleMessage(handlers, msg)
    if (res) output.write(JSON.stringify(res) + '\n')
  })
  return rl
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv.slice(2).find((a) => !a.startsWith('--'))
  serve(dir ? resolve(dir) : resolve(dirname(fileURLToPath(import.meta.url)), '../..'))
}
