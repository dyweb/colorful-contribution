/*
 * @Author: gigaflower
 * @Date:   2017-11-19 13:55:57
 * @Last Modified by:   gigaflw
 * @Last Modified time: 2018-09-13 15:01:11
 */

/*
 * Save the selected `theme` into `chrome.storage.local` so that
 * content script `colorful.js` can find it.
 */

// TODO: shading on icon gallery

let CGC = window.CGC // defined in `CGC.js`. Explict announcement to avoid ambiguity
const COLOR_REG = /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/ // e.g. '#11AAdd'

// util func
function findAncestor(elem, elemClass) {
  while (elem !== null) {
    if (elem.classList.contains(elemClass)) return elem
    elem = elem.parentNode
  }
  return null
}

/*
 * Convert `theme.patterns` into html str
 * @params: patternStr: { String }
 *   there are three types of valid patternStr:
 *     1. color: '#AAABBB', '#7FF', etc. (begins with '#')
 *     2. icon: 'icons/XXX.png'   a icon file
 *     3. dataURL: 'data:image/XXXX'
 */
function getPatternBlockStr(patternStr) {
  let patternType = 'none'

  if (patternStr.startsWith('#')) patternType = 'color'
  else if (patternStr.startsWith('icons/') || patternStr.startsWith('data:image/')) patternType = 'icon'

  return {
    color: `<div class="pattern-block" style="background-color: ${patternStr}"></div>`,
    icon: `<div class="pattern-block" style="background-image: url(${patternStr})"></div>`,
    none: `<div class="pattern-block">Error</div>`,
  }[patternType]
}

/*
 * Get the html block of a theme
 * the arg `theme` will be modified during theme editing events
 * so the passed `theme` should be preserved
 */
function getThemeBlock(theme) {
  console.assert(theme instanceof Theme, "invalid theme: " + theme)

  let [patternBlocksStr, posterBlockStr, typeStr] = function() {
    let pat, patStr, posStr, typeStr;

    if (theme.type == Theme.CHROMA_TYPE) {
      pat = theme.patterns
      posStr = '<span>NONE</span>'
      typeStr = 'Type: Chroma'
    } else if (theme.type == Theme.POSTER_TYPE) {
      pat = CGC.defaultTheme.patterns
      posStr = `<div style="background-image: url(${theme.poster})"></div>` // other css propoerties will be handled by popup.css
      typeStr = 'Type: Poster'
    }

    patStr = pat.reduce((acc, cur) => acc + getPatternBlockStr(cur), '')
    patStr = `
      ${patStr}
      <div class="color-edit-box underline hidden" data-idx="0">
        <input class="invisible-input" type="text" disabled value="${pat[0].match(COLOR_REG) ? pat[0] : '<icon>'}">
      </div>`

    return [patStr, posStr, typeStr]
  }()

  let themeBlockHTML = `
  <div class="theme-block" data-name="${theme.name}" data-type-name="${theme.type}">
    <div class="theme-type">${typeStr}</div>
    <div class="theme-name underline">
      <input class="invisible-input" type="text" value="${theme.name}" disabled>
    </div>
    <div class="theme-patterns">
      ${patternBlocksStr}
    </div>
    <div class="theme-poster">
      ${posterBlockStr}
    </div>
    <div class="theme-editor">
      <i class="fa fa-pencil edit-btn" title="Enter editor mode"></i>
      <i class="fa fa-trash  del-btn"  title="Delete this theme"></i>
      <i class="fa fa-retweet flip-btn" title="Switch between theme types"></i>
    </div>
  </div>`

  let themeBlock = document.createElement('div')
  themeBlock.innerHTML = themeBlockHTML
  themeBlock = themeBlock.childNodes[1]

  // Bind events

  // Editor stuff
  let editBtn = themeBlock.querySelector('.edit-btn'),
    delBtn = themeBlock.querySelector('.del-btn'),
    flipBtn = themeBlock.querySelector('.flip-btn'),
    nameInput = themeBlock.querySelector('.theme-name input'),
    colorInput = themeBlock.querySelector('.color-edit-box input'),
    patternBlocks = themeBlock.querySelectorAll('.pattern-block')

  // Modify theme name
  bindNameInput(nameInput, theme)

  // Modify theme colors
  bindColorInput(colorInput, theme)

  // Delete theme
  bindDelBtn(delBtn, theme)

  // Toggle edit mode for this theme
  bindEditBtn(editBtn, theme)

  // When a theme block is flipped, it switches between poster theme mode and chroma theme mode
  bindFlipBtn(flipBtn, theme)

  // Color blocks
  patternBlocks.forEach(block => bindPatternBlock(block, theme))

  return themeBlock
}

//////////////////////////////
// Editor Functinos
//////////////////////////////
function bindNameInput(nameInputElem, theme) {
  nameInputElem.addEventListener('change', event => {
    document.querySelector(`.theme-block[data-name=${theme.name}]`).dataset.name = event.target.value
    theme.name = event.target.value
    CGC.saveThemes()
  })
}

function bindColorInput(colorInputElem, theme) {
  colorInputElem.addEventListener('input', event => {
    let elem = event.target,
      colorStr = elem.value

    if (!colorStr.match(COLOR_REG)) return  // illegal color string

    let idx = findAncestor(elem, 'color-edit-box').dataset.idx
    let patternBlock = findAncestor(elem, 'theme-patterns').querySelectorAll('.pattern-block')[idx]
    patternBlock.style['background-color'] = colorStr
    patternBlock.style['background-image'] = ''
    theme.patterns[idx] = colorStr
    CGC.saveThemes()
    CGC.sendTheme(theme)
  })
}

function bindDelBtn(delBtn, theme) {
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
}

function bindEditBtn(editBtn, theme) {
  editBtn.addEventListener('click', event => {
    // Toggling editing mode when click on the edit button
    let block = findAncestor(event.target, 'theme-block'),
      editing = block.classList.contains('editing')
    setEditMode(block, !editing)
  })
}

function bindFlipBtn(flipBtn, theme) {
  flipBtn.addEventListener('click', event => {
    // Toggling theme type (chroma/poster) when click on the flip button
    let block = findAncestor(event.target, 'theme-block')

    block.classList.remove('show-flip-up')
    block.classList.add('show-flip-down')

    function _flip() {
      if (block.dataset.typeName === Theme.CHROMA_TYPE) {
        // flip to poster theme
        theme.type = Theme.POSTER_TYPE
        setThemeType(block, Theme.POSTER_TYPE)
        CGC.sendTheme(theme)
      } else {
        // flip to chroma theme
        theme.type = Theme.CHROMA_TYPE
        setThemeType(block, Theme.CHROMA_TYPE)
        CGC.sendTheme(theme)
      }

      block.classList.remove('show-flip-down')
      block.classList.add('show-flip-up')
    }
    window.setTimeout(_flip, 600) // slightly longer than the animation duration (500ms)
  })
}

function bindPatternBlock(patternBlock, theme) {
  // .colorInput should follow the mouse as it enter a pattern block
  patternBlock.addEventListener('mouseenter', event => {
    let cb = event.target,
      isEditing = findAncestor(cb, 'theme-block').classList.contains('editing'),
      editBox = findAncestor(cb, 'theme-patterns').querySelector('.color-edit-box')

    if (isEditing) {
      editBox.style.left = (cb.offsetLeft + cb.offsetWidth / 2 - editBox.offsetWidth / 2) + 'px'
      editBox.dataset.idx = cb.offsetLeft / cb.offsetWidth

      let patternStr = theme.patterns[editBox.dataset.idx]
      editBox.querySelector('input').value = patternStr.match(COLOR_REG) ? patternStr : '<icon>'
    }
  })
}

function bindGallery(gallery) {
  gallery.addEventListener('click', event => {
    if (!event.target.classList.contains('icon')) {
      chrome.runtime.openOptionsPage()
      return
    }

    let icon = event.target,
      themeBlock = gallery.previousSibling,  // gallery will be moved to be after of the theme block being edited
      theme = CGC.getTheme(themeBlock.dataset.name)

    // set the content of patternBlock to icon
    let colorInput = themeBlock.querySelector('.color-edit-box'),
      idx = colorInput.dataset.idx,
      patternBlock = themeBlock.querySelectorAll('.theme-patterns .pattern-block')[idx]

    patternBlock.style = `background-image: url(${icon.src})`
    colorInput.querySelector('input').value = '<icon>'

    theme.patterns[idx] = icon.src
    CGC.saveThemes()
    CGC.sendTheme(theme)
  })
}

function bindFootPanel(footPanel, themePanel) {
  let addBtn = footPanel.querySelector('.add-btn'),
      undoBtn = footPanel.querySelector('.undo-btn')
  addBtn.addEventListener('click', event => {
    let theme = CGC.addNewTheme()
    let themeBlock = getThemeBlock(theme)
    themePanel.appendChild(themeBlock)
  })
  undoBtn.addEventListener('click', event => {
    if (undoBtn.classList.contains('warning')) {
      CGC.clearStorage()
      window.location.reload()
    } else {
      undoBtn.classList.add('warning')
    }
  })
  footPanel.addEventListener('mouseleave', event => {
    undoBtn.classList.remove('warning')
  })
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
 *  Theme type will be displayed on the theme block when in editor mode.
 *  @param: themeType { string }
 *    one of [ Theme.POSTER_TYPE, Theme.CHROMA_TYPE, ...]
 */
function setThemeType(themeBlock, themeType) {
  themeBlock.dataset.typeName = themeType
  switch (themeType) {
    case Theme.CHROMA_TYPE:
      themeBlock.querySelector('.theme-type').textContent = 'Type: Chroma'
      break
    case Theme.POSTER_TYPE:
      themeBlock.querySelector('.theme-type').textContent = 'Type: Poster'
      break
    default:
      console.error(`Unknown theme type: '${themeType}', valid: 'chroma' | 'poster'`)
  }
}
//////////////////////////////
// Editor Functinos End
//////////////////////////////


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
 * initialize popup html
 */
function initPopup() {

  // Theme panel
  let themePanel = document.getElementById('theme-panel')
  let fragment = document.createDocumentFragment()
  for (let theme of CGC.allThemes) {
    let themeBlock = getThemeBlock(theme)
    fragment.appendChild(themeBlock)
  }
  themePanel.appendChild(fragment)

  // Icon gallery
  let gallery = document.getElementById('icon-gallery')
  function appendIcon(iconId, imgElem) {
    imgElem.classList.add('icon')
    gallery.appendChild(imgElem)
  }

  CGC.getIconAsImgs((iconId, imgElem) => appendIcon(iconId, imgElem))

  bindGallery(gallery)

  // Foot Panel
  let footPanel = document.getElementById('foot-panel')
  bindFootPanel(footPanel, themePanel)
}

document.addEventListener('DOMContentLoaded', () => {
  let themePanel = document.getElementById('theme-panel')

  chrome.storage.sync.get('CGC_all', (obj) => {
    if (!obj['CGC_all']) {
      CGC.initStorage()
      CGC.allThemes = CGC.defaultThemes
    } else {
      CGC.allThemes = obj['CGC_all'].map(obj => Theme.fromObject(obj))
    }

    initPopup()

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
      let inEditorArea = false, inBlockArea = false, isEditing = false, isSelected = false

      while (elem !== themePanel) {
        if (elem.classList.contains('theme-editor')) {
          inEditorArea = true
        }
        if (elem.classList.contains('theme-block')) {
          // found the block we want
          inBlockArea = true
          isEditing = elem.classList.contains('editing')
          isSelected = elem.classList.contains('selected')
          break
        }
        elem = elem.parentNode
      }

      if (inBlockArea && !inEditorArea && !isEditing && !isSelected) {
        // will not select a theme by clicking on its editor area
        resetAllThemeBlocks(elem.dataset.name)
        setTheme(elem.dataset.name) // every .theme-block should have a data-name field
      }
    })
  })
})
