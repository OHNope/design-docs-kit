import { defineConfig } from 'vitepress'
import { fileURLToPath } from 'node:url'
import { buildSidebar } from './kit/sidebar.mjs'
import { uiStrings, searchTokenize } from './kit/ui.mjs'

const lang = '__LANG__'
const ui = uiStrings(lang)
const editPattern = '__EDIT_PATTERN__'

export default defineConfig({
  title: '__TITLE__',
  lang,
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ['**/README.md'],
  themeConfig: {
    // Generated from the files: add a page and it shows up here.
    sidebar: buildSidebar(fileURLToPath(new URL('..', import.meta.url))),
    outline: ui.outline,
    docFooter: ui.docFooter,
    lastUpdated: ui.lastUpdated,
    returnToTopLabel: ui.returnToTopLabel,
    sidebarMenuLabel: ui.sidebarMenuLabel,
    darkModeSwitchLabel: ui.darkModeSwitchLabel,
    embedOpenLabel: ui.embedOpenLabel,
    editLink: editPattern ? { pattern: editPattern, text: ui.editLink } : undefined,
    search: {
      provider: 'local',
      options: {
        miniSearch: { options: { tokenize: searchTokenize } },
        translations: {
          button: { buttonText: ui.search.buttonText, buttonAriaLabel: ui.search.buttonText },
          modal: {
            displayDetails: ui.search.details,
            resetButtonTitle: ui.search.reset,
            backButtonTitle: ui.search.back,
            noResultsText: ui.search.noResults,
            footer: { selectText: ui.search.select, navigateText: ui.search.navigate, closeText: ui.search.close },
          },
        },
      },
    },
  },
})
