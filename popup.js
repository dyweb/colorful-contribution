/*
 * @Author: gigaflower
 * @Date:   2017-11-19 13:55:57
 * @Last Modified by:   gigaflw
 * @Last Modified time: 2018-01-23 14:49:16
 */

/*
 * Save the selected `theme` into `chrome.storage.local` so that
 * content script `colorful.js` can find it.
 */
function sendTheme(theme) {
  if (!theme) return

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
function initButtons(themes) {
  if (!themes) return

  let fragment = document.createDocumentFragment()
  for (let theme of themes) {
    let themeBlock = document.createElement('div'),
      themeNameBlock = document.createElement('div'),
      themeColorBlock = document.createElement('div')

    themeNameBlock.classList.add('theme-name')
    themeNameBlock.appendChild(document.createTextNode(theme.name))

    themeColorBlock.classList.add('theme-colors')
    for (let color of theme.colors) {
      let colorBlock = document.createElement('div')
      colorBlock.classList.add('color-block')
      colorBlock.style['background-color'] = color
      themeColorBlock.appendChild(colorBlock)
    }

    themeBlock.classList.add('theme-block')
    themeBlock.dataset.name = theme.name
    themeBlock.appendChild(themeNameBlock)
    themeBlock.appendChild(themeColorBlock)

    fragment.appendChild(themeBlock)
  }
  document.getElementById('color-select').appendChild(fragment)
}


document.addEventListener('DOMContentLoaded', () => {
  let colorSelect = document.getElementById('color-select')
  let themes = null

  chrome.storage.sync.get('colorful-github-all', (obj) => {
    if (!obj['colorful-github-all']) {
      initStorage()
      themes = window.CGC_CONFIG.default_themes
    } else {
      themes = obj['colorful-github-all']
    }

    initButtons(themes)

    function setTheme(themeName) {
      sendTheme(themes.find(t => t.name == themeName))
      chrome.storage.sync.set({ 'colorful-github-selected': themeName })
      colorSelect.dataset.selected = themeName
      Array.prototype.forEach.call(colorSelect.querySelectorAll('.theme-block'), blk => {
        if (blk.dataset.name === themeName) {
          blk.classList.add('selected')
        } else {
          blk.classList.remove('selected')
        }
      })
    }

    chrome.storage.sync.get('colorful-github-selected', (obj) => {
      if (!chrome.runtime.lastError) {
        setTheme(obj['colorful-github-selected'])
      }
    })

    colorSelect.addEventListener('click', (event) => {
      let elem = event.target

      while (!elem.classList.contains('theme-block')) {
        elem = elem.parentNode
      }
      // every .theme-block should have a data-name field
      setTheme(elem.dataset.name)
    })
  })

})
