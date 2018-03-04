/*
 * @Author: gigaflower
 * @Date:   2017-11-19 13:55:57
 * @Last Modified by:   gigaflw
 * @Last Modified time: 2018-03-04 15:48:34
 */

/*
 * Save the selected `theme` into `chrome.storage.local` so that
 * content script `colorful.js` can find it.
 */

let CGC = window.CGC // defined in `config.js`. Explict announcement to avoid ambiguity

// util func
function findAncestor(elem, elemClass) {
  while (elem !== null) {
    if (elem.classList.contains(elemClass)) return elem
    elem = elem.parentNode
  }
  return null
}

/*
 * Get the html block of a theme
 * the arg `theme` will be modified during theme editing events
 * so the passed `theme` should be preserved
 */
function getThemeBlock(theme) {
  // TODO: This function is too LONG!
  console.assert(theme.name)
  console.assert(theme.colors && theme.colors.length > 0)

  let colorBlocksStr = theme.colors.reduce(function(acc, cur) {
    str = CGC.colorType(cur) === 'color' ?
      `<div class="color-block" style="background-color: ${cur}"></div>` :
      `<div class="color-block" style="background-image: url(${cur})"></div>`
    return acc + str
  }, '')

  let themeBlockHTML = `
  <div class="theme-block" data-name="${theme.name}">
    <div class="theme-name underline">
      <input class="invisible-input" type="text" value="${theme.name}" disabled>
    </div>
    <div class="theme-colors">
      ${colorBlocksStr}
      <div class="color-edit-box underline hidden" data-idx="0">
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
    colorInput = themeBlock.querySelector('.color-edit-box input'),
    colorBlocks = themeBlock.querySelectorAll('.color-block')

  // Modify theme name
  nameInput.addEventListener('change', event => {
    document.querySelector(`.theme-block[data-name=${theme.name}]`).dataset.name = event.target.value
    theme.name = event.target.value
    CGC.saveThemes()
  })

  // Modify theme colors
  colorInput.addEventListener('input', event => {
    let elem = event.target,
      colorStr = elem.value

    if (!colorStr.match(/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/)) return  // illegal color string

    let idx = findAncestor(elem, 'color-edit-box').dataset.idx
    let colorBlock = findAncestor(elem, 'theme-colors').querySelectorAll('.color-block')[idx]
    colorBlock.style['background-color'] = colorStr
    theme.colors[idx] = colorStr
    CGC.saveThemes()
    CGC.sendTheme(theme)
  })

  // Delete theme
  delBtn.addEventListener('click', event => {
    if (!event.target.classList.contains('confirming')) {
      // first click, change style to ask for confirm
      event.target.classList.add('confirming')
    } else {
      // confirmed, delete it
      CGC.deleteTheme(theme)
      let block = findAncestor(event.target, 'theme-block')
      block.classList.add('deleted')    // display disappearance effect
      window.setTimeout(() => block.remove(), 500) // add a time delay to diplay the full deletion animation
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

  for (let cb of colorBlocks) {
    cb.addEventListener('mouseenter', event => {
      let cb = event.target,
        isEditing = findAncestor(cb, 'theme-block').classList.contains('editing'),
        editBox = findAncestor(cb, 'theme-colors').querySelector('.color-edit-box')

      if (isEditing) {
        editBox.style.left = (cb.offsetLeft + cb.offsetWidth / 2 - editBox.offsetWidth / 2) + 'px'
        editBox.dataset.idx = cb.offsetLeft / cb.offsetWidth
        editBox.querySelector('input').value = theme.colors[editBox.dataset.idx]
      }
    })
  }

  return themeBlock
}

/*
 * Enter/Leave edit mode for a theme block ( with class '.theme-block' )
 * If in editing mode:
 *  a. theme name editable with a underline
 *  b. theme color editable, with an extra color string input field (again, with a underline)
 *  c. edit button is a check denoting save
 *  d. icon gallery become visible right below the theme block
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
  let gallery = document.getElementById('icon-gallery')

  if (val) {
    // entering edit mode

    // only 1 block can enter edit mode at once
    for (let b of themeBlock.parentNode.querySelectorAll('.theme-block')) {
      setEditMode(b, false)
    }

    btn.classList.remove('fa-pencil')
    btn.classList.add('fa-check')
    themeBlock.classList.add('editing')
    colorInput.disabled = nameInput.disabled = false  // editable
    nameInput.focus()

    themeBlock.insertAdjacentElement('afterend', gallery)
    gallery.classList.remove('hidden')

  } else {
    // leave edit mode
    btn.classList.add('fa-pencil')
    btn.classList.remove('fa-check')
    themeBlock.classList.remove('editing')
    colorInput.disabled = nameInput.disabled = true // non-editable

    gallery.classList.add('hidden')
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

  // Icon gallery
  let gallery = document.getElementById('icon-gallery')
  function appendIcon(dataURL, id) {
    let img = document.createElement('img')
    img.classList.add('icon')
    img.src = dataURL
    gallery.appendChild(img)
  }

  CGC.getIcons(
    (dataURL, fileName) => appendIcon(dataURL, fileName),
    (dataURL, date) => appendIcon(dataURL, date),
  )

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
      let inEditorArea = false, inBlockArea = false, isEditing = false

      while (elem !== themePanel) {
        if (elem.classList.contains('theme-editor')) {
          inEditorArea = true
        }
        if (elem.classList.contains('theme-block')) {
          // found the block we want
          inBlockArea = true
          isEditing = elem.classList.contains('editing')
          break
        }
        elem = elem.parentNode
      }

      if (inBlockArea && !inEditorArea && !isEditing) {
        // will not select a theme by clicking on its editor area
        resetAllThemeBlocks(elem.dataset.name)
        setTheme(elem.dataset.name) // every .theme-block should have a data-name field
      }
    })
  })
})
