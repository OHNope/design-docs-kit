// Shared helpers for the docs site: page listing, search, reading and checks.
// This file is copied into <docs>/.vitepress/kit/ by `design-docs-kit init`,
// so it must stay dependency-free.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, resolve, dirname, sep, posix } from 'node:path'

const SKIP_DIRS = new Set(['.vitepress', 'public', 'node_modules', '.git'])

export function toPosix(p) {
  return p.split(sep).join('/')
}

// All Markdown pages under docsDir, as posix paths relative to it, sorted so
// that a directory's index.md comes first and the rest follow by file name.
export function listPageFiles(docsDir) {
  const out = []
  const walk = (dir) => {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      if (e.name.startsWith('.')) continue
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name))
      } else if (e.name.endsWith('.md') && e.name !== 'README.md') {
        out.push(toPosix(relative(docsDir, join(dir, e.name))))
      }
    }
  }
  walk(docsDir)
  return out.sort(comparePagePaths)
}

export function comparePagePaths(a, b) {
  const pa = a.split('/')
  const pb = b.split('/')
  const n = Math.min(pa.length, pb.length)
  for (let i = 0; i < n; i++) {
    if (pa[i] === pb[i]) continue
    const lastA = i === pa.length - 1
    const lastB = i === pb.length - 1
    if (lastA && pa[i] === 'index.md') return -1
    if (lastB && pb[i] === 'index.md') return 1
    // Files before directories at the same level; the kit's own guide/ goes last.
    if (lastA !== lastB) return lastA ? -1 : 1
    if (i === 0 && (pa[0] === 'guide') !== (pb[0] === 'guide')) return pa[0] === 'guide' ? 1 : -1
    return pa[i].localeCompare(pb[i], 'en', { numeric: true })
  }
  return pa.length - pb.length
}

// Splits a page into lines tagged with whether they sit inside a code fence.
export function scanLines(text) {
  const lines = text.split(/\r?\n/)
  const out = []
  let fence = null
  let inFrontmatter = lines[0] === '---'
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (inFrontmatter) {
      out.push({ line, n: i + 1, code: true, frontmatter: true })
      if (i > 0 && line === '---') inFrontmatter = false
      continue
    }
    const m = line.match(/^\s*(`{3,}|~{3,})/)
    if (m) {
      if (!fence) fence = m[1]
      else if (m[1][0] === fence[0] && m[1].length >= fence.length) {
        out.push({ line, n: i + 1, code: true })
        fence = null
        continue
      }
    }
    out.push({ line, n: i + 1, code: Boolean(fence) })
  }
  return out
}

export function parsePage(text) {
  const lines = scanLines(text)
  let title = null
  let titleLine = 0
  const headings = []
  for (const l of lines) {
    if (l.code) continue
    const m = l.line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (!m) continue
    const level = m[1].length
    if (level === 1 && title === null) {
      title = m[2]
      titleLine = l.n
    }
    headings.push({ level, text: m[2], line: l.n })
  }
  return { title, titleLine, headings, summary: summaryOf(lines, titleLine) }
}

// The first plain paragraph after the title: by the house rule it states the
// page's conclusion, so it doubles as the page summary.
function summaryOf(lines, titleLine) {
  const para = []
  for (const l of lines) {
    if (l.n <= titleLine || l.code) {
      if (para.length && l.code) break
      continue
    }
    const t = l.line.trim()
    // Container fences (::: info) are skipped; their text counts as a paragraph.
    if (t.startsWith(':::')) {
      if (para.length) break
      continue
    }
    if (!t) {
      if (para.length) break
      continue
    }
    if (/^(#|\||<|!\[|[-*+]\s|\d+\.\s|>)/.test(t)) {
      if (para.length) break
      if (/^#/.test(t)) break
      continue
    }
    para.push(t)
  }
  const s = stripInline(para.join(' '))
  return s.length > 200 ? s.slice(0, 199) + '…' : s
}

export function stripInline(s) {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]+/g, '')
    .trim()
}

export function readPageFile(docsDir, path) {
  return readFileSync(join(docsDir, path), 'utf8')
}

export function listPages(docsDir) {
  return listPageFiles(docsDir).map((path) => {
    const p = parsePage(readPageFile(docsDir, path))
    return { path, title: p.title ?? path, summary: p.summary }
  })
}

// Resolves a user-supplied page path inside docsDir; refuses anything outside.
export function resolvePage(docsDir, path) {
  let p = String(path || '').trim().replace(/^\/+/, '')
  if (!p || p.endsWith('/')) p += 'index.md'
  if (!p.endsWith('.md')) p += existsSync(join(docsDir, p)) && statSync(join(docsDir, p)).isDirectory() ? '/index.md' : '.md'
  const abs = resolve(docsDir, p)
  const rel = relative(docsDir, abs)
  if (rel.startsWith('..') || resolve(abs) === resolve(docsDir)) return null
  return existsSync(abs) ? toPosix(rel) : null
}

// Returns the whole page, or only the section under the first heading whose
// text contains `heading` (up to the next heading of the same or higher level).
export function readSection(text, heading) {
  if (!heading) return text
  const lines = scanLines(text)
  const needle = heading.toLowerCase()
  let start = -1
  let level = 0
  for (const l of lines) {
    if (l.code) continue
    const m = l.line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (!m) continue
    if (start < 0 && m[2].toLowerCase().includes(needle)) {
      start = l.n - 1
      level = m[1].length
    } else if (start >= 0 && m[1].length <= level) {
      return lines.slice(start, l.n - 1).map((x) => x.line).join('\n').trimEnd()
    }
  }
  if (start < 0) return null
  return lines.slice(start).map((x) => x.line).join('\n').trimEnd()
}

// Plain substring search: every whitespace-separated term must appear in the
// line (case-insensitive). Works for CJK text, which has no word breaks.
export function searchDocs(docsDir, query, limit = 10) {
  const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return []
  const hits = []
  for (const path of listPageFiles(docsDir)) {
    const text = readPageFile(docsDir, path)
    const { title } = parsePage(text)
    let heading = title ?? ''
    for (const l of scanLines(text)) {
      if (l.frontmatter) continue
      const hm = !l.code && l.line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/)
      if (hm) heading = hm[1]
      const low = l.line.toLowerCase()
      if (!terms.every((t) => low.includes(t))) continue
      const inTitle = terms.every((t) => (title ?? '').toLowerCase().includes(t))
      hits.push({
        path,
        title: title ?? path,
        heading,
        line: l.n,
        text: l.line.trim().slice(0, 240),
        score: (hm ? 2 : 0) + (inTitle ? 3 : 0),
      })
    }
  }
  hits.sort((a, b) => b.score - a.score)
  return hits.slice(0, limit)
}

const LINK_RE = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const EMBED_RE = /<Embed\b[^>]*\bsrc=["']([^"']+)["'][^>]*\/?>/g

function stripCodeSpans(line) {
  return line.replace(/`+[^`]*`+/g, (m) => ' '.repeat(m.length))
}

// Checks every page. Errors break the build or a reader's path; warnings are
// house-style problems worth fixing.
export function checkDocs(docsDir) {
  const errors = []
  const warnings = []
  const publicDir = join(docsDir, 'public')
  const usedAssets = new Set()
  const pages = listPageFiles(docsDir)
  for (const path of pages) {
    const text = readPageFile(docsDir, path)
    const parsed = parsePage(text)
    const at = (n) => `${path}:${n}`
    if (!parsed.title) errors.push(`${at(1)} page has no "# Title" heading`)
    else if (!parsed.summary) warnings.push(`${at(parsed.titleLine)} no opening paragraph under the title (state the page's conclusion first)`)
    const h1s = parsed.headings.filter((h) => h.level === 1)
    for (const h of h1s.slice(1)) warnings.push(`${at(h.line)} second "# " heading; use "## " inside a page`)
    for (const l of scanLines(text)) {
      if (l.code) continue
      const line = stripCodeSpans(l.line)
      // Vue interpolates double braces even inside inline code; only fenced
      // code blocks are safe.
      if (/\{\{|\}\}/.test(l.line)) errors.push(`${at(l.n)} "{{" or "}}" outside a fenced code block breaks the Vue build`)
      for (const m of line.matchAll(EMBED_RE)) {
        const src = m[1]
        const file = join(publicDir, src.replace(/^\/+/, ''))
        usedAssets.add(toPosix(relative(publicDir, file)))
        if (!existsSync(file)) errors.push(`${at(l.n)} embed not found: public/${src.replace(/^\/+/, '')}`)
      }
      for (const m of line.matchAll(LINK_RE)) {
        const target = m[1]
        if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) continue
        const clean = decodeURIComponent(target.split('#')[0].split('?')[0])
        if (!clean) continue
        const problem = checkLocalTarget(docsDir, publicDir, path, clean, usedAssets)
        if (problem) errors.push(`${at(l.n)} ${problem}: ${target}`)
      }
      const tagLine = line.replace(EMBED_RE, '')
      const tag = tagLine.match(/<\/?([A-Za-z][\w-]*)/)
      if (tag && !ALLOWED_TAGS.has(tag[1].toLowerCase())) {
        warnings.push(`${at(l.n)} raw <${tag[1]}> tag; escape "<" as &lt; unless the HTML is intended`)
      }
    }
  }
  for (const dir of ['embeds']) {
    const abs = join(publicDir, dir)
    if (!existsSync(abs)) continue
    for (const f of readdirSync(abs)) {
      const rel = `${dir}/${f}`
      if (f.endsWith('.html') && !usedAssets.has(rel)) warnings.push(`public/${rel} is not embedded by any page`)
    }
  }
  return { pages: pages.length, errors, warnings }
}

const ALLOWED_TAGS = new Set(['br', 'sup', 'sub', 'kbd', 'details', 'summary', 'img', 'a', 'span', 'div', 'iframe', 'figure', 'figcaption', 'mark', 'badge'])

function checkLocalTarget(docsDir, publicDir, fromPath, target, usedAssets) {
  let abs
  if (target.startsWith('/')) {
    const inPublic = join(publicDir, target)
    if (existsSync(inPublic) && statSync(inPublic).isFile()) {
      usedAssets.add(toPosix(relative(publicDir, inPublic)))
      return null
    }
    abs = join(docsDir, target)
  } else {
    abs = resolve(docsDir, dirname(fromPath), target)
  }
  if (relative(docsDir, abs).startsWith('..')) return 'link leaves the docs folder'
  const candidates = [abs, abs + '.md', join(abs, 'index.md'), abs.replace(/\.html$/, '.md')]
  if (candidates.some((c) => existsSync(c) && statSync(c).isFile())) return null
  return 'broken link'
}

export const posixJoin = posix.join
