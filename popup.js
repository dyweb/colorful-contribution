/*
 * @Author: gigaflower
 * @Date:   2017-11-19 13:55:57
 * @Last Modified by:   gigaflw
 * @Last Modified time: 2018-11-05 13:52:57
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
  while (elem && elem.classList) {
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
  console.log("CGC: Selecting theme " + themeName)
  if (!themeName) return
  let themePanel = document.getElementById('theme-panel')

  CGC.setTheme(themeName)
  themePanel.dataset.selected = themeName
  themePanel.querySelector(`.theme-block[data-name=${themeName}]`).classList.add('selected')
}

function getEditingThemeBlock() {
  return document.querySelector('.theme-block.editing')
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
    if (!event.target.classList.contains('icon')) return

    let icon = event.target,
      themeBlock = getEditingThemeBlock(),
      theme = CGC.getTheme(themeBlock.dataset.name)

    if (!icon.dataset.src) return

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

  gallery.querySelector('.flip-btn').addEventListener('click', event => {
    console.log('in')
    // TODO: extract flip animation
    let tab = findAncestor(gallery, 'tab')

    tab.classList.remove('show-flip-up')
    tab.classList.add('show-flip-down')

    function _flip() {
      // display the second half of the animation
      tab.classList.remove('show-flip-down')
      tab.classList.add('show-flip-up')

      tab.classList.toggle('hide-nth-child-1')
      tab.classList.toggle('hide-nth-child-2')
    }

    window.setTimeout(_flip, 600) // slightly longer than the animation duration (500ms)
  })
}

function bindPosterGallery(gallery) {
  gallery.addEventListener('click', event => {
    if (!event.target.classList.contains('poster')) return

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
    resetPalette()

  } else {
    // leave edit mode
    editBtn.classList.add('fa-pencil')
    editBtn.classList.remove('fa-check')

    themeBlock.classList.remove('editing')
    colorInput.disabled = nameInput.disabled = true // non-editable

    galleries.classList.add('hidden')
  }
}

/*
 * Palette is the color pickler located in the icon gallery
 */
function initPalette() {
  let palette = document.querySelector('.palette'),
      hexagons = Array.from(palette.querySelectorAll('.hexagon')) // should be 5
      sliders = Array.from(palette.querySelectorAll('.slider')) // should be 3, corresponding to h,s,l

  // init & bind event for sliders
  sliders.forEach((slider, ind) => {
    win = slider.querySelector('.window')
    win.style.cssText = 'left: 0;'

    slider.addEventListener("click", event => {
      let percent = (event.clientX - slider.offsetLeft) / slider.clientWidth
      slider.dataset['val'] = percent.toFixed(4)

      // collect hsl and update the pattern block color
      let [h, s, l] = sliders.map(s => parseFloat(s.dataset['val'])),
          selectedIdx = parseInt(palette.dataset['selected']),
          patternBlocks = getEditingThemeBlock().querySelectorAll('.pattern-block'),
          newColors = []
      newColors[selectedIdx] = [h, s, l]

      // if chained, auto-calc the gradients for hexagons/pattern blocks in the chained range
      if (hexagons[selectedIdx].classList.contains('chained')) {
        let beg = parseInt(palette.dataset['rangeBeg']),
            end = parseInt(palette.dataset['rangeEnd']),
            colors = [],
            hexToHSL = hex => CGC_util.rgbStr2hsl(hex.style['background-color']),
            zip = (pred, ...arrs) => Array.from(Array(arrs[0].length).keys()).map(ind => pred(...arrs.map(arr => arr[ind])))

        if (selectedIdx !== beg && selectedIdx !== end) {
          throw new Error("selected index " + selectedIdx + " is not one of the range ends: " + [beg, end])
        }
        colors[beg] = hexToHSL(hexagons[beg])
        colors[end] = hexToHSL(hexagons[end])
        colors[selectedIdx] = [h, s, l]
        let step = zip((x, y) => (y - x) / (end - beg), colors[beg], colors[end])
        for (let i = beg + 1; i < end; ++i) {
          colors[i] = zip((x, y) => x + y, colors[i-1], step)
        }

        newColors = colors
      }

      for (let i = 0; i < newColors.length; ++i) {
        if (!newColors[i]) continue
        let [h, s, l] = newColors[i]
        patternBlocks[i].style['background-color'] = `hsl(${h * 360}, ${s * 100}%, ${l * 100}%)`
      }

      adaptPalette() // true means only changes color, leave dataset untouched
      // move the window
      // change the hsl color of selected hexagon
      // auto-calc all the other blocks
      // change the color of the theme
    })
  })

  // init & bind event for hexagons
  let hexN = hexagons.length
  hexagons.forEach((hexagon, ind) => {
    hexagon.addEventListener('click', event => {
      palette.dataset['selected'] = ind

      // only one hexagon can be selected (the selected hexagon's color is adjustable by the color picker)
      for (let i = 0; i < hexN; ++i) {
        hexagons[i].classList[(i == ind) ? 'add' : 'remove']('selected')
      }

      // only two hexagons can be large (the large hexagons denote the range of auto gradient)
      let beg = parseInt(palette.dataset['rangeBeg']),
          end = parseInt(palette.dataset['rangeEnd']),
          oldRange = [beg, end]

      if (ind !== beg && ind !== end) {// range changed
        hexagon.classList.remove('small')
        if (Math.abs(ind - beg) <= Math.abs(ind - end)) {
          hexagons[beg].classList.add('small')
          beg = palette.dataset['rangeBeg'] = ind
        } else {
          hexagons[end].classList.add('small')
          end = palette.dataset['rangeEnd'] = ind
        }
      }

      // change chained range
      !function() {
        if (!palette.querySelector('.chain-btn').classList.contains('activated')) return
        if (oldRange[0] === beg && oldRange[1] === end) return

        for (let i = 0; i < hexN; ++i) {
          hexagons[i].classList[(i >= beg && i <= end) ? 'add' : 'remove']('chained')
        }
      }()

      adaptPaletteSliders()
    })
  })

  // biind event for btns
  let chainBtn = palette.querySelector('.chain-btn'),
      flipBtn = palette.querySelector('.flip-btn')

  chainBtn.addEventListener('click', event => {
    chainBtn.classList.toggle('activated')

    let chained = chainBtn.classList.contains('activated')

    if (!chained) {
      hexagons.forEach(hex => hex.classList.remove('chained'))
    } else {
      let beg = palette.dataset['rangeBeg']
          end = palette.dataset['rangeEnd']

      if (!(!!beg && !!end)) return

      for (let i = beg; i <= end; ++i) {
        hexagons[i].classList.add('chained')
      }
    }
  })

  flipBtn.addEventListener('click', event => {
    // Toggling theme type (chroma/poster) when click on the flip button
    let tab = findAncestor(flipBtn, 'tab')

    tab.classList.remove('show-flip-up')
    tab.classList.add('show-flip-down')

    function _flip() {
      // display the second half of the animation
      tab.classList.remove('show-flip-down')
      tab.classList.add('show-flip-up')

      tab.classList.toggle('hide-nth-child-1')
      tab.classList.toggle('hide-nth-child-2')
    }

    window.setTimeout(_flip, 600) // slightly longer than the animation duration (500ms)
  })
}

function adaptPalette() {
  adaptPaletteHexagons()
  adaptPaletteSliders()
}

function resetPalette() {
  let palette = document.querySelector('.palette'),
      hexagons = palette.querySelectorAll('.hexagon')

  // reset dataset
  delete palette.dataset['selected']
  delete palette.dataset['rangeBeg']
  delete palette.dataset['rangeEnd']
  delete palette.dataset['initialized']

  // reset chained state
  palette.querySelector('.chain-btn').classList.remove('activated');
  [].forEach.call(hexagons, hex => hex.classList.remove('chained'))

  // reset
  adaptPalette()
}

/*
 * Read the colors of the editing block and adjust hexagons correspondingly
 * Will initialize the css for hexagons if the editing theme has changed,
 *   otherwise, do nothing
 */
function adaptPaletteHexagons() {
  let themeBlock = getEditingThemeBlock()

  if (!themeBlock) {
    console.warn("adaptPalette is called but no themeBlock is selected!")
    return
  }

  let palette = document.querySelector('.palette'),
      hexagons = palette.querySelectorAll('.hexagon')

  // set the css for hexagons
  let match = null,
      pbs = themeBlock.querySelectorAll('.pattern-block')
      colors = [].map.call(pbs, pb => pb.style['background-color'])

  let firstInd = -1, lastInd = -1

  for (let i = 0; i < colors.length; ++i) {
    if (!colors[i]) { // the pattern is an icon instead of a color
      hexagons[i].classList.add('empty')
    } else {
      hexagons[i].classList.remove('empty')
      if (firstInd < 0 && i > 0) { firstInd = i } // first color (except the index 0, which is very probably white/grey and excluded from auto-gradient)
      if (i > lastInd) { lastInd = i }
      hexagons[i].style.cssText = `background-color: ${colors[i]}`
    }
  }

  // generate params
  if (!!palette.dataset['initialized']) return

  if (firstInd < 0 || lastInd < 0) throw new Error("TODO: Not enough color blocks")

  for (let i = 0; i < colors.length; ++i) {
    hexagons[i].classList[(i == firstInd || i == lastInd) ? 'remove' : 'add']('small')
    hexagons[i].classList[(i == lastInd) ? 'add' : 'remove']('selected')
  }

  palette.dataset['selected'] = lastInd
  palette.dataset['rangeBeg'] = firstInd
  palette.dataset['rangeEnd'] = lastInd
  palette.dataset['initialized'] = 1
}

/*
 * Read the color of selected hexagon and adjust sliders correspondingly
 */
function adaptPaletteSliders() {
  let palette = document.querySelector('.palette'),
      hexagons = palette.querySelectorAll('.hexagon'),
      sliders = palette.querySelectorAll('.slider'),
      color = hexagons[palette.dataset['selected']].style['background-color'],
      [h, s, l] = CGC_util.rgbStr2hsl(color)

  // set the sliders according to the selected hsl
  for (let i = 0; i < 3; ++i) {
    let sl = sliders[i],
        w = sl.querySelector('.window'),
        x = [h, s, l][i],
        gradStr = [
          CGC_util.range(0, 361, 30).map(x => `hsl(${x}, ${s * 100}%, ${l * 100}%)`),
          CGC_util.range(0, 101, 10).map(x => `hsl(${h * 360}, ${x}%, ${l * 100}%)`),
          CGC_util.range(0, 101, 10).map(x => `hsl(${h * 360}, ${s * 100}%, ${x}%)`),
        ][i].join(', ')

    sl.dataset['val'] = x.toFixed(4)
    sl.style.cssText = 'background-image: linear-gradient(90deg, ' + gradStr + ');'
    w.style.left = (sl.offsetWidth * x - w.offsetWidth / 2) + 'px'
  }
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

  // Palette
  initPalette()

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
