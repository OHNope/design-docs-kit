// VitePress UI strings per site language.
const STRINGS = {
  'zh-CN': {
    outline: { label: '本页目录', level: [2, 3] },
    docFooter: { prev: '上一页', next: '下一页' },
    lastUpdated: { text: '最后更新' },
    editLink: '在 GitHub 上编辑本页',
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '目录',
    darkModeSwitchLabel: '深色模式',
    embedOpenLabel: '全屏打开',
    search: { buttonText: '搜索', noResults: '没有找到', details: '显示详细列表', reset: '清除', back: '关闭搜索', select: '打开', navigate: '切换', close: '关闭' },
  },
  ja: {
    outline: { label: 'このページの目次', level: [2, 3] },
    docFooter: { prev: '前のページ', next: '次のページ' },
    lastUpdated: { text: '最終更新' },
    editLink: 'GitHub でこのページを編集',
    returnToTopLabel: 'トップに戻る',
    sidebarMenuLabel: '目次',
    darkModeSwitchLabel: 'ダークモード',
    embedOpenLabel: '全画面で開く',
    search: { buttonText: '検索', noResults: '見つかりません', details: '詳細を表示', reset: 'クリア', back: '検索を閉じる', select: '開く', navigate: '移動', close: '閉じる' },
  },
  en: {
    outline: { label: 'On this page', level: [2, 3] },
    docFooter: { prev: 'Previous', next: 'Next' },
    lastUpdated: { text: 'Last updated' },
    editLink: 'Edit this page on GitHub',
    returnToTopLabel: 'Back to top',
    sidebarMenuLabel: 'Menu',
    darkModeSwitchLabel: 'Dark mode',
    embedOpenLabel: 'Open full screen',
    search: { buttonText: 'Search', noResults: 'No results', details: 'Show detailed list', reset: 'Clear', back: 'Close search', select: 'to select', navigate: 'to navigate', close: 'to close' },
  },
}

export function uiStrings(lang) {
  return STRINGS[lang] ?? STRINGS[lang?.split('-')[0]] ?? STRINGS.en
}

// MiniSearch splits on spaces and punctuation, which leaves CJK text as one
// long token. Index every character pair instead so substring queries match.
export function searchTokenize(text) {
  const tokens = []
  for (const run of String(text).toLowerCase().split(/[\s\p{P}\p{S}]+/u)) {
    if (!run) continue
    if (!/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(run)) {
      tokens.push(run)
      continue
    }
    const chars = [...run]
    if (chars.length === 1) tokens.push(run)
    for (let i = 0; i < chars.length - 1; i++) tokens.push(chars[i] + chars[i + 1])
  }
  return tokens
}
