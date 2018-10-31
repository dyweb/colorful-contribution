/*
 * @Author: gigaflower
 * @Date:   2017-11-19 13:55:57
 * @Last Modified by:   gigaflw
 * @Last Modified time: 2018-10-31 14:57:51
 */

/*
 * Save the selected `theme` into `chrome.storage.local` so that
 * content script `colorful.js` can find it.
 */

let CGC = window.CGC // defined in `CGC.js`. Explict announcement to avoid ambiguity
const COLOR_REG = /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/ // e.g. '#11AAdd'

////////////////
// Utils
////////////////
function findAncestor(elem, elemClass) {
  while (elem !== null) {
    if (elem.classList.contains(elemClass)) return elem
    elem = elem.parentNode
  }
  return null
}

/*
 *  Theme type will be displayed on the theme block when in editor mode.
 *  @param: themeType { string }
 *    one of the keys of Theme.TYPES
 */
function setThemeTypeTxt(themeBlock, themeType) {
  themeBlock.dataset.typeName = themeType
  let cls = Theme.getClass(themeType)

  switch (cls) {
    case ChromaTheme:
      themeBlock.querySelector('.theme-type').textContent = 'Type: Chroma'
      break
    case PosterTheme:
      themeBlock.querySelector('.theme-type').textContent = 'Type: Poster'
      break
    default:
      throw new RangeError(`Unknown theme type: '${themeType}'`)
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


function selectTheme(themeName) {
  if (!themeName) return
  let themePanel = document.getElementById('theme-panel')

  CGC.setTheme(themeName)
  themePanel.dataset.selected = themeName
  themePanel.querySelector(`.theme-block[data-name=${themeName}]`).classList.add('selected')
}

////////////////
// Utils End
////////////////


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
  if (!theme instanceof Theme) throw Error("invalid theme: " + theme)

  let [patternBlocksStr, posterBlockStr, typeStr] = function() {
    let pat = theme.patterns || CGC.defaultTheme.patterns;
    let posStr = theme.poster ? `<div style="background-image: url(${theme.poster})"></div>` : '<span>NONE</span>' // other css propoerties will be handled by popup.css

    let typeStr;
    if (theme instanceof ChromaTheme) {
      typeStr = 'Type: Chroma'
    } else if (theme instanceof PosterTheme) {
      typeStr = 'Type: Poster'
    }

    let patStr = pat.reduce((acc, cur) => acc + getPatternBlockStr(cur), '')
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

  // NOTE: theme.poster may be just an label pointing into the storage, instead of the url itself
  // Thanks to storage retrieval being asynchronous, we have to rewrite the url afterwards
  // I have to expose the supposedly inner class PosterTheme to this file, which is stink.
  // Also, PosterTheme being a fake subclass (see theme.js) add to the illness (see all the `call`s)
  // Need reconstructing someday.
  if (!posterBlockStr.includes("NONE")) {
    theme.waitForStorageCallback(() => {
      let url = theme.getPosterUrl()
      if (url) {
        themeBlock.querySelector('.theme-poster div').style = `background-image: url(${url})`
      } else {
        // may happen when the selected poster has already been deleted
        themeBlock.querySelector('.theme-poster').innerHTML = "<span>NONE</span>"
      }
    })
  }

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
// Editor Functions
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

    let themeBlock = findAncestor(elem, 'theme-block')
    if (themeBlock.classList.contains('selected')) CGC.sendTheme(theme)
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
  let galleries = document.getElementById('galleries')

  let types = Object.keys(Theme.TYPES)
  let typeFilpMapping = {}
  for (let ind in types) {
    ind = parseInt(ind)
    typeFilpMapping[types[ind]] = types[ (ind + 1) % types.length ]
  }

  flipBtn.addEventListener('click', event => {
    // Toggling theme type (chroma/poster) when click on the flip button
    let block = findAncestor(event.target, 'theme-block')

    block.classList.remove('show-flip-up')
    block.classList.add('show-flip-down')

    function _flip() {
      // display the second half of the animation
      block.classList.remove('show-flip-down')
      block.classList.add('show-flip-up')

      // modify the data
      let targetType = typeFilpMapping[block.dataset.typeName]
      if (!targetType) throw new RangeError("Unknown type: " + block.dataset.typeName)
      theme.setThemeType(targetType)
      setThemeTypeTxt(block, targetType)

      // change the theme on the page if the block is selected
      let selected = block.classList.contains('selected')
      if (selected) CGC.sendTheme(theme)

      // flip the gallery (will show animation)
      galleries.dataset.typeName = targetType
    }

    window.setTimeout(_flip, 600) // slightly longer than the animation duration (500ms)
  })
}

function bindPatternBlock(patternBlock, theme) {
  // .colorInput should follow the mouse as it enter a pattern block
  patternBlock.addEventListener('mouseenter', event => {
    let pb = event.target,
      isEditing = findAncestor(pb, 'theme-block').classList.contains('editing'),
      editBox = findAncestor(pb, 'theme-patterns').querySelector('.color-edit-box')

    if (isEditing) {
      editBox.style.left = (pb.offsetLeft + pb.offsetWidth / 2 - editBox.offsetWidth / 2) + 'px'
      editBox.dataset.idx = Math.round(pb.offsetLeft / pb.offsetWidth)

      let patternStr = theme.patterns[editBox.dataset.idx]
      editBox.querySelector('input').value = patternStr.match(COLOR_REG) ? patternStr : '<icon>'
    }
  })
}

function bindIconGallery(gallery) {
  gallery.addEventListener('click', event => {
    // when clicking on the gallery, jump to option page
    if (!event.target.classList.contains('icon')) {
      chrome.runtime.openOptionsPage()
      return
    }

    let icon = event.target,
      themeBlock = getEditingThemeBlock(),
      theme = CGC.getTheme(themeBlock.dataset.name)

    // set the content of patternBlock to icon
    let colorInput = themeBlock.querySelector('.color-edit-box'),
      idx = colorInput.dataset.idx,
      patternBlock = themeBlock.querySelectorAll('.theme-patterns .pattern-block')[idx]

    patternBlock.style = `background-image: url(${icon.dataset.src})`
    colorInput.querySelector('input').value = '<icon>'

    theme.setThemeType('chroma')
    theme.setPattern(idx, icon.dataset.src)
    CGC.saveThemes()
    if (themeBlock.classList.contains('selected')) CGC.sendTheme(theme)
  })
}

function bindPosterGallery(gallery) {
  gallery.addEventListener('click', event => {
    // when clicking on the gallery, jump to option page
    if (!event.target.classList.contains('poster')) {
      chrome.runtime.openOptionsPage()
      return
    }

    let poster = event.target,
      themeBlock = getEditingThemeBlock(),  // gallery will be moved to be after of the theme block being edited
      theme = CGC.getTheme(themeBlock.dataset.name)

    let posterBlock = themeBlock.querySelector('.theme-poster')
    posterBlock.innerHTML = "<div></div>"
    posterBlock.firstElementChild.style = `background-image: ${poster.style['background-image']}`
      // can not do change tag and set background together because the "//" in url will get censored

    theme.setThemeType('poster')
    theme.setPoster(poster.dataset.src)
    CGC.saveThemes()
    if (themeBlock.classList.contains('selected')) CGC.sendTheme(theme)
  })
}

function bindFootPanel(footPanel, themePanel) {
  let addBtn = footPanel.querySelector('.add-btn'),
      undoBtn = footPanel.querySelector('.undo-btn')
  addBtn.addEventListener('click', event => {
    let theme = CGC.addNewTheme()
    let themeBlock = getThemeBlock(theme)
    themePanel.appendChild(themeBlock)
    setEditMode(themeBlock, true)
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
  let editBtn = themeBlock.querySelector('.edit-btn'),
    nameInput = themeBlock.querySelector('.theme-name input'),
    colorInput = themeBlock.querySelector('.color-edit-box input')

  let galleries = document.getElementById('galleries')

  if (val) {
    // entering edit mode

    // only 1 block can enter edit mode at once
    for (let b of themeBlock.parentNode.querySelectorAll('.theme-block')) {
      setEditMode(b, false)
    }

    // now edit btn means the completion of editing
    editBtn.classList.remove('fa-pencil')
    editBtn.classList.add('fa-check')

    themeBlock.classList.add('editing')
    colorInput.disabled = nameInput.disabled = false  // editable
    nameInput.focus()

    // move galleries right below the theme block
    galleries.dataset.typeName = themeBlock.dataset.typeName
    themeBlock.insertAdjacentElement('afterend', galleries)
    window.setTimeout(() => galleries.classList.remove('hidden'), 0) // 0 timeout to smooth the animation

  } else {
    // leave edit mode
    editBtn.classList.add('fa-pencil')
    editBtn.classList.remove('fa-check')

    themeBlock.classList.remove('editing')
    colorInput.disabled = nameInput.disabled = true // non-editable

    galleries.classList.add('hidden')
  }
}

function getEditingThemeBlock() {
  return document.querySelector('.theme-block.editing')
}
//////////////////////////////
// Editor Functinos End
//////////////////////////////


/*
 * initialize popup html
 */
function initPopup() {
  let themePanel = document.getElementById('theme-panel')

  // Foot Panel ( bind foot panel first to ensure the functionality of resetting )
  let footPanel = document.getElementById('foot-panel')
  bindFootPanel(footPanel, themePanel)

  // Theme panel
  let fragment = document.createDocumentFragment()
  for (let theme of CGC.allThemes) {
    let themeBlock = getThemeBlock(theme)
    fragment.appendChild(themeBlock)
  }
  themePanel.appendChild(fragment)

  // Theme panel (Cont.)
  // When clicking on a theme panel, select it
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
      selectTheme(elem.dataset.name) // every .theme-block should have a data-name field
    }
  })

  // Icon gallery
  let iconGallery = document.getElementById('icon-gallery')
  function appendIcon(id, imgElem) {
    imgElem.classList.add('icon')
    iconGallery.appendChild(imgElem)
  }

  CGC.getIconAsImgs((id, imgElem) => appendIcon(id, imgElem))

  bindIconGallery(iconGallery)

  // Poster gallery
  let posterGallery = document.getElementById('poster-gallery')
  function appendPoster(id, imgElem) {
    imgElem.classList.add('poster')
    posterGallery.appendChild(imgElem)
  }

  CGC.getPosterAsImgs((id, imgElem) => appendPoster(id, imgElem))

  bindPosterGallery(posterGallery)
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get('CGC_all', (obj) => {
    if (!obj['CGC_all']) {
      CGC.initStorage()
      CGC.allThemes = CGC.defaultThemes
    } else {
      CGC.allThemes = obj['CGC_all'].map(obj => Theme.fromObject(obj))
    }

    initPopup()

    // Reload selected theme
    chrome.storage.sync.get('CGC_selected', (obj) => {
      selectTheme(obj['CGC_selected'])
    })
  })
})
