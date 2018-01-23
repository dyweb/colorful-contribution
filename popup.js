/*
 * @Author: gigaflower
 * @Date:   2017-11-19 13:55:57
 * @Last Modified by:   gigaflw
 * @Last Modified time: 2018-01-23 21:50:46
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

function saveThemes(themes) {
  chrome.storage.sync.set({'colorful-github-all': themes})
}

/*
 * Add options to popup pages according to `themes`
 */
function initButtons(themes) {
  if (!themes) return

  let fragment = document.createDocumentFragment()

  for (let theme of themes) {
    let colorBlocksStr = theme.colors.reduce((acc, cur) =>
      acc + `<div class="color-block" style="background-color: ${cur}"></div>`, '')

    let themeBlockHTML = `
    <div class="theme-block" data-name="${theme.name}">
      <div class="theme-name underline">
        <input class="invisible-input" type="text" value="${theme.name}" disabled>
      </div>
      <div class="theme-colors">
        ${colorBlocksStr}
        <div class="color-edit-box underline hidden">
          <input class="invisible-input" type="text" value="${theme.colors[0]}" disabled>
        </div>
      </div>
      <div class="theme-editor">
        <i class="fa fa-pencil edit-btn"></i>
        <i class="fa fa-trash del-btn"></i>
      </div>
    </div>`

    let themeBlock = document.createElement('div')
    themeBlock.innerHTML = themeBlockHTML
    themeBlock = themeBlock.childNodes[1]

    // Editor stuff
    let editBtn = themeBlock.querySelector('.edit-btn'),
      delBtn = themeBlock.querySelector('.del-btn'),
      nameInput = themeBlock.querySelector('.theme-name input'),
      colorInput = themeBlock.querySelector('.color-edit-box input')

    nameInput.addEventListener('change', event => {
      theme.name = event.target.value
      saveThemes(themes)
    })

    colorInput.addEventListener('change', event => {
      // TODO
      theme.colors[1] = event.target.value
      saveThemes(themes)
    })

    delBtn.addEventListener('click', event => {
      if (confirm(`Are you sure to delete the theme '${theme.name}'?`)) {
        let ind = themes.indexOf(theme)
        themes.splice(ind, 1)
        saveThemes(themes)
        window.location.reload()
      }
    })

    editBtn.addEventListener('click', event => {
      // Toggling editing mode when click on the edit button
      // if in editing mode:
      //  a. theme name editable with a underline
      //  b. theme color editable, with an extra color string input field (again, with a underline)
      //  c. edit button is a floppy denoting save
      let btn = event.target,
        block = btn.parentNode.parentNode,
        nameInput = block.querySelector('.theme-name input'),
        colorInput = block.querySelector('.color-edit-box input')

      if (!block.classList.contains('editing')) {
        // entering edit mode
        btn.classList.remove('fa-pencil')
        btn.classList.add('fa-floppy-o')
        block.classList.add('editing')
        colorInput.parentNode.classList.remove('hidden') // show extra color string field
        colorInput.disabled = nameInput.disabled = false  // editable
      } else {
        // entering non-edit mode
        btn.classList.add('fa-pencil')
        btn.classList.remove('fa-floppy-o')
        block.classList.remove('editing')
        colorInput.parentNode.classList.add('hidden')   // hide extra color string field
        colorInput.disabled = nameInput.disabled = true // non-editable
      }
    })


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
        if (elem.classList.contains('theme-editor')) return // will not select the theme if clicked on editor area
        elem = elem.parentNode
      }
      // every .theme-block should have a data-name field
      setTheme(elem.dataset.name)
    })
  })

})
