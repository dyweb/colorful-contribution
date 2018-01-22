function setColor(theme) {
  chrome.storage.local.set({
    'colorful-github': theme
  }, () => {
    chrome.tabs.executeScript({
      file: 'colorful.js'
    })
  })
}

function initStorage() {
  let colors = ['#111', '#555', '#888', '#bbb', '#eee'] // from more to less
  let colorsThreshold = [10, 8, 5, 3, 0]

  let themes = [{
    name: 'foo1',
    colors: colors,
    thresholds: colorsThreshold
  }, {
    name: 'foo2',
    colors: colors,
    thresholds: colorsThreshold
  }, ]

  chrome.storage.sync.set({
    'colorful-github-all': themes,
    'colorful-github-selected': '',
  })

  return themes
}

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
      themes = initStorage()
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
      setColor(themes.find(t => t.name == dropdown.value))
      chrome.storage.sync.set({
        'colorful-github-selected': dropdown.value,
      })
    })
  })

})
