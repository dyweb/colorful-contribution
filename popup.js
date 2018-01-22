/*
 * @Author: gigaflower
 * @Date:   2017-11-19 13:55:57
 * @Last Modified by:   gigaflw
 * @Last Modified time: 2018-01-22 22:15:48
 */

/*
 * Save the selected `theme` into `chrome.storage.local` so that
 * content script `colorful.js` can find it.
 */
function setTheme(theme) {
  if (!theme.thresholds) {
    theme.thresholds = window.CGC_CONFIG.default_thresholds
  }

  chrome.storage.local.set({
    'colorful-github': theme
  }, () => {
    chrome.tabs.executeScript({
      file: 'colorful.js'
    })
  })
}

/*
 * Init `chrome.storage.sync` where permanent user settings are saved
 */
function initStorage() {
  chrome.storage.sync.set({
    'version': window.CGC_CONFIG.version,
    'colorful-github-all': window.CGC_CONFIG.default_themes,
    'colorful-github-selected': ''
  })
}

/*
 * Add options to popup pages according to `themes`
 */
function initDropdown(themes) {
  if (!themes) return
  let opts = document.createDocumentFragment()
  for (let theme of themes) {
    let opt = document.createElement('option')
    opt.value = theme.name
    opt.appendChild(document.createTextNode(theme.name))
    opts.appendChild(opt)
  }
  document.getElementById('color-select').appendChild(opts)
}


document.addEventListener('DOMContentLoaded', () => {
  let dropdown = document.getElementById('color-select')
  let themes = null

  chrome.storage.sync.get('colorful-github-all', (obj) => {
    if (!obj['colorful-github-all']) {
      initStorage()
      themes = window.CGC_CONFIG.default_themes
    } else {
      themes = obj['colorful-github-all']
    }

    initDropdown(themes)

    chrome.storage.sync.get('colorful-github-selected', (obj) => {
      if (!chrome.runtime.lastError) {
        dropdown.value = obj['colorful-github-selected']
      }
    })

    dropdown.addEventListener('change', () => {
      setTheme(themes.find(t => t.name == dropdown.value))
      chrome.storage.sync.set({
        'colorful-github-selected': dropdown.value,
      })
    })
  })

})
