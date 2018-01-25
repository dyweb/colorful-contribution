/*
 * @Author: gigaflower
 * @Date:   2017-11-19 13:55:57
 * @Last Modified by:   gigaflw
 * @Last Modified time: 2018-01-25 16:30:17
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
    CGC.saveThemes(CGC.all_themes)
  })

  // Modify theme colors
  colorInput.addEventListener('change', event => {
    // TODO
    theme.colors[1] = event.target.value
    CGC.saveThemes(CGC.all_themes)
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

  // Toggle per-thtem edit mode
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

  return themeBlock
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

  chrome.storage.sync.get('colorful-github-all', (obj) => {
    if (!obj['colorful-github-all']) {
      CGC.initStorage()
      CGC.all_themes = CGC.default_themes
    } else {
      CGC.all_themes = obj['colorful-github-all']
    }

    initThemes()

    function setTheme(themeName) {
      CGC.setTheme(themeName)
      themePanel.dataset.selected = themeName

      Array.prototype.forEach.call(themePanel.querySelectorAll('.theme-block'), blk => {
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

    themePanel.addEventListener('click', (event) => {
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
