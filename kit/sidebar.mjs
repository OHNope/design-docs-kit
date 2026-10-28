// Builds the VitePress sidebar from the files on disk, so adding a page never
// needs a config edit: a folder's index.md names the group, the other pages
// follow by file name (prefix them 01-, 02-, ... to set the order).
import { listPageFiles, parsePage, readPageFile } from './lib.mjs'

function linkOf(path) {
  return '/' + path.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')
}

export function buildSidebar(docsDir) {
  const pages = listPageFiles(docsDir).map((path) => ({
    path,
    title: parsePage(readPageFile(docsDir, path)).title ?? path,
  }))
  const root = { items: [], groups: new Map() }
  for (const p of pages) {
    const parts = p.path.split('/')
    let node = root
    for (const dir of parts.slice(0, -1)) {
      if (!node.groups.has(dir)) {
        const group = { text: dir, items: [], groups: new Map() }
        node.groups.set(dir, group)
        node.items.push(group)
      }
      node = node.groups.get(dir)
    }
    if (parts.length > 1 && parts.at(-1) === 'index.md') {
      node.text = p.title
      node.link = linkOf(p.path)
    } else {
      node.items.push({ text: p.title, link: linkOf(p.path) })
    }
  }
  const strip = (n) => {
    const out = { text: n.text }
    if (n.link) out.link = n.link
    if (n.groups) {
      out.collapsed = false
      out.items = n.items.map(strip)
    }
    return out
  }
  return root.items.map(strip)
}
