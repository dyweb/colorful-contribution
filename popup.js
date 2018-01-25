/*
 * @Author: gigaflower
 * @Date:   2017-11-19 13:55:57
 * @Last Modified by:   gigaflw
 * @Last Modified time: 2018-01-25 17:33:46
 */

/*
 * Save the selected `theme` into `chrome.storage.local` so that
 * content script `colorful.js` can find it.
 */

let CGC = window.CGC // defined in `config.js`. Explict announcement to avoid ambiguity

/*
 * Get the html block of a theme
 * the arg `theme` will be modified during theme editing events
 * so the passed `theme` should be preserved
 */
function getThemeBlock(theme) {
  // TODO: This function is too LONG!
  console.assert(theme.name)
  console.assert(theme.colors && theme.colors.length > 0)

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

  // Bind events

  // Editor stuff
  let editBtn = themeBlock.querySelector('.edit-btn'),
    delBtn = themeBlock.querySelector('.del-btn'),
    nameInput = themeBlock.querySelector('.theme-name input'),
    colorInput = themeBlock.querySelector('.color-edit-box input')

  // Modify theme name
  nameInput.addEventListener('change', event => {
    document.querySelector(`.theme-block[data-name=${theme.name}]`).dataset.name = event.target.value
    theme.name = event.target.value
    CGC.saveThemes()
  })

  // Modify theme colors
  colorInput.addEventListener('change', event => {
    // TODO
    theme.colors[1] = event.target.value
    CGC.saveThemes()
  })

  // Delete theme
  delBtn.addEventListener('click', event => {
    if (!event.target.classList.contains('confirming')) {
      // first click, change style to ask for confirm
      event.target.classList.add('confirming')
    } else {
      // confirmed, delete it
      CGC.deleteTheme(theme)
      window.location.reload()
    }
  })

  // Toggle per-theme edit mode
  editBtn.addEventListener('click', event => {
    // Toggling editing mode when click on the edit button
    let block = event.target.parentNode.parentNode
    if (!block.classList.contains('editing')) {
      setEditMode(block, true)
    } else {
      setEditMode(block, false)
    }
  })

  return themeBlock
}

/*
 * Enter/Leave edit mode for a theme block ( with class '.theme-block' )
 * If in editing mode:
 *  a. theme name editable with a underline
 *  b. theme color editable, with an extra color string input field (again, with a underline)
 *  c. edit button is a floppy denoting save
 *  
 * @param: themeBlock: {Node}
 *   a node with class 'theme-block', do nothing if not
 * @param: val {Bool}
 *   false : leave edit mode
 *   anything else : enter edit mode
 *   
 */
function setEditMode(themeBlock, val) {
  if (!themeBlock || !themeBlock.classList.contains('theme-block')) return

  if (val !== false) { val = true }
  let btn = themeBlock.querySelector('.edit-btn'),
    nameInput = themeBlock.querySelector('.theme-name input'),
    colorInput = themeBlock.querySelector('.color-edit-box input')

  if (val) {
    // entering edit mode
    btn.classList.remove('fa-pencil')
    btn.classList.add('fa-floppy-o')
    themeBlock.classList.add('editing')
    colorInput.disabled = nameInput.disabled = false  // editable
  } else {
    // leave edit mode
    btn.classList.add('fa-pencil')
    btn.classList.remove('fa-floppy-o')
    themeBlock.classList.remove('editing')
    colorInput.disabled = nameInput.disabled = true // non-editable
  }
}

/*
 * Clear all css states
 *
 * @param: except: {String}
 *   if given, theme blocks with `theme.dataset.name == except` will not be reset
 */
function resetAllThemeBlocks(except) {
  let blocks = document.querySelectorAll('#theme-panel .theme-block')
  for (let b of blocks) {
    if (b.dataset.name === except) continue

    b.classList.remove('selected')
    b.querySelector('.del-btn').classList.remove('confirming')
    setEditMode(b, false)
  }
}

/*
 * initialize popup html according to CGC.all_themes
 */
function initThemes() {
  let themePanel = document.getElementById('theme-panel'),
      footPanel = document.getElementById('foot-panel')

  // Theme panel
  let fragment = document.createDocumentFragment()
  for (let theme of CGC.all_themes) {
    let themeBlock = getThemeBlock(theme)
    fragment.appendChild(themeBlock)
  }
  themePanel.appendChild(fragment)

  // Foot panel
  let addBtn = footPanel.querySelector('.add-btn')
  addBtn.addEventListener('click', event => {
    let theme = CGC.addNewTheme()
    let themeBlock = getThemeBlock(theme)
    themePanel.appendChild(themeBlock)
  })
}

document.addEventListener('DOMContentLoaded', () => {
  let themePanel = document.getElementById('theme-panel')

  chrome.storage.sync.get('CGC_all', (obj) => {
    if (!obj['CGC_all']) {
      CGC.initStorage()
      CGC.all_themes = CGC.default_themes
    } else {
      CGC.all_themes = obj['CGC_all']
    }

    initThemes()

    function setTheme(themeName) {
      if (!themeName) return
      CGC.setTheme(themeName)
      themePanel.dataset.selected = themeName
      themePanel.querySelector(`.theme-block[data-name=${themeName}]`).classList.add('selected')
    }

    // Reload selected theme
    chrome.storage.sync.get('CGC_selected', (obj) => {
      if (!chrome.runtime.lastError) {
        setTheme(obj['CGC_selected'])
      }
    })

    // Add click event of setting themes
    themePanel.addEventListener('click', (event) => {
      let elem = event.target
      let inEditorArea = false, inBlockArea = false

      while (elem !== themePanel) {
        if (elem.classList.contains('theme-editor')) {
          inEditorArea = true
        }
        if (elem.classList.contains('theme-block')) {
          // found the block we want
          inBlockArea = true
          break
        }
        elem = elem.parentNode
      }

      if (inBlockArea) {
        resetAllThemeBlocks(elem.dataset.name)
        if (!inEditorArea) {
          // will not select a theme by clicking on its editor area
          setTheme(elem.dataset.name) // every .theme-block should have a data-name field
        }
      }
    })
  })

})
