/*
* @Author: gigaflw
* @Date:   2018-11-05 15:11:54
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-11-06 22:53:26
*/

class ThemeManager {
  /*
   * Convert `theme.patterns` into html str
   * @params: patternStr: { String }
   *   there are three types of valid patternStr:
   *     1. color: '#AAABBB', '#7FF', etc. (begins with '#')
   *     2. icon: 'icons/XXX.png'   a icon file
   *     3. dataURL: 'data:image/XXXX'
   */
  static getPatternBlockStr(patternStr) {
    let patternType = 'none'

    if (patternStr.startsWith('icons/') || patternStr.startsWith('data:image/')) patternType = 'icon'
    else if (patternStr.match(Theme.COLOR_REG)) patternType = 'color'
    else {
      throw new Error("CGC> Can not parse pattern string: " + patternStr)
    }

    return {
      color: `<div class="pattern-block" style="background-color: ${patternStr}"></div>`,
      icon: `<div class="pattern-block" style="background-image: url(${patternStr})"></div>`,
      none: `<div class="pattern-block">Error</div>`,
    }[patternType]
  }

  static getThemeBlock(theme) {
    let [patternBlocksStr, posterBlockStr, typeStr] = function() {
      let pat = theme.patterns || CGC.defaultTheme.patterns;
      let posStr = theme.poster ? `<div style="background-image: url(${theme.poster})"></div>` : '<span>NONE</span>' // other css propoerties will be handled by popup.css

      let typeStr;
      if (theme instanceof ChromaTheme) {
        typeStr = 'Type: Chroma'
      } else if (theme instanceof PosterTheme) {
        typeStr = 'Type: Poster'
      }

      let patStr = pat.reduce((acc, cur) => acc + ThemeManager.getPatternBlockStr(cur), '')
      patStr = `
        ${patStr}
        <div class="color-edit-box underline hidden" data-idx="0">
          <input class="invisible-input" type="text" disabled value="${pat[0].match(Theme.COLOR_REG) ? pat[0] : '<icon>'}">
        </div>`

      return [patStr, posStr, typeStr]
    }()

    let themeBlockHTML = `
    <div class="theme-block" data-theme-id="${theme.id}" data-type-name="${theme.type}">
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
        <i class="js-edit-btn fa fa-btn fa-pencil-alt" title="Enter editor mode"></i>
        <div class="js-del-btn-group">
          <i class="js-del-cancel-btn fa fa-btn fa-times"  title="Do not delete"></i>
          <i class="js-del-btn far fa-btn fa-trash-alt" title="Delete this theme"></i>
        </div>
        <i class="js-flip-btn fa fa-btn fa-retweet" title="Switch between theme types"></i>
      </div>
    </div>`

    let themeBlock = document.createElement('div')
    themeBlock.innerHTML = themeBlockHTML
    themeBlock = themeBlock.childNodes[1]

    return themeBlock
  }

  /*
   * the arg `theme` will be modified during theme editing events
   * so the passed `theme` should be preserved
   */
  constructor(theme) {
    if (!theme instanceof Theme) throw Error("invalid theme: " + theme)

    this.theme = theme

    // producing html
    let tb = this.themeBlock = ThemeManager.getThemeBlock(theme)

    // NOTE: theme.poster may be just an label pointing into the storage, instead of the url itself
    // Thanks to storage retrieval being asynchronous, we have to rewrite the url afterwards
    // I have to expose the supposedly inner class PosterTheme to this file, which is stink.
    if (theme.poster) {
      theme.waitForStorageCallback(() => {
        let url = theme.getPosterUrl()
        if (url) {
          tb.querySelector('.theme-poster div').style = `background-image: url(${url})`
        } else {
          // may happen when the selected poster has already been deleted
          tb.querySelector('.theme-poster').innerHTML = "<span>NONE</span>"
        }
      })
    }

    // identify components
    this.editBtn = tb.querySelector('.js-edit-btn')
    this.delBtnGroup = tb.querySelector('.js-del-btn-group')
    this.delBtn = tb.querySelector('.js-del-btn')
    this.delCancelBtn = tb.querySelector('.js-del-cancel-btn')
    this.flipBtn = tb.querySelector('.js-flip-btn')
    this.nameInput = tb.querySelector('.theme-name input')
    this.colorInput = tb.querySelector('.color-edit-box input')
    this.colorInputBox = tb.querySelector('.color-edit-box')
    this.patternBlocks = Array.from(tb.querySelectorAll('.pattern-block'))
    this.patternBox = tb.querySelector('.theme-patterns')
    this.posterBox = tb.querySelector('.theme-posters')
  }

  setEventCb(eventName, cb) {
    let allowedEvents = ['flipThemeType', 'enterEditMode', 'leaveEditMode']
    if (!allowedEvents.includes(eventName)) {
      throw new Error('Unknown manager event name: ' + eventName + '. Allowed: ' + allowedEvents)
    }
    this[eventName + 'Cb'] = cb
  }

  reset() {
    this.themeBlock.classList.remove('selected')
    this.delBtnGroup.classList.remove('confirming')
    this.setEditMode(false)
  }

  isSelected() {
    return this.themeBlock.classList.contains('selected')
  }

  setSelected() {
    this.themeBlock.classList.add('selected')
  }
 
  /*
   * Enter/Leave edit mode for a theme block ( with class '.theme-block' )
   * If in editing mode:
   *  a. theme name editable with a underline
   *  b. theme color editable, with an extra color string input field (again, with a underline)
   *  c. edit button is a check denoting save
   *  d. icon gallery become visible right below the theme block
   *  
   * @param: val {Bool}
   *   false : leave edit mode
   *   anything else : enter edit mode
   *   
   */
  setEditMode(val) {
    val = !!val

    if (val) { // entering edit mode
      // only 1 block can enter edit mode at once
      for (let manager of Object.values(CGC.managers)) {
        manager.setEditMode && manager.setEditMode(false)
      }

      this.themeBlock.classList.add('editing')

      this.editBtn.classList.add('activated')
      // this.editBtn.classList.remove('fa-pencil-alt')
      // this.editBtn.classList.add('fa-check')

      this.colorInput.disabled = this.nameInput.disabled = false  // editable
      this.nameInput.focus()

      this.enterEditModeCb(this)

    } else { // leave edit mode

      this.themeBlock.classList.remove('editing')

      this.editBtn.classList.remove('activated')
      // this.editBtn.classList.add('fa-pencil-alt')
      // this.editBtn.classList.remove('fa-check')

      this.colorInput.disabled = this.nameInput.disabled = true // non-editable

      this.leaveEditModeCb(this)
    }
  }

  getEditingPatternBlockIdx() {
    return this.colorInputBox.dataset.idx
  }

  getEditingPatternBlock() {
    return this.patternBlocks[this.colorInputBox.dataset.idx]
  }

  /*
   * Get a list of the color strings of the pattern blocks.
   * Maybe null if the block is an icon instead of a color
   * e.g.
   *   ['rgb(0, 0, 0)', null, '#123', ...]
   * Whatever the color format is, it is guaranteed to be recognized by css
   */
  getPatternBlockColors() {
     return this.patternBlocks.map(pb => pb.style['background-color'])
  }

  /*
   * Set the colors for pattern blocks
   *
   * setColors([null, 'rgb(1,2,3)', '#111', 'hsl(0, 70%, 80%)', null])
   *   mean keep the 1st and 5th block unchanged, and set the css of the others
   */
  setColors(colors) {
    colors.forEach((color, ind) => {
      let pb = this.patternBlocks[ind]
      if (color) {
        pb.style['background-image'] = ''
        pb.style['background-color'] = color

        this.theme.setPattern(ind, pb.style['background-color'])
      }
    })

    CGC.saveThemes()
    if (this.isSelected()) CGC.sendTheme(this.theme)
  }

  setPoster(backgoundImgUrl) {
    this.posterBox.innerHTML = "<div></div>"
    this.posterBox.firstElementChild.style = `background-image: ${backgoundImgUrl}`
        // can not do tag changing and background setting together because the "//" in url will get censored
  }

  /***********
   * Events
   ***********/
  bindEvents() {
    this._bindNameInput()   // Modify theme name
    this._bindColorInput()  // Modify theme colors
    this._bindDelBtn()      // Delete theme
    this._bindEditBtn()     // Toggle edit mode for this theme
    this._bindFlipBtn()     // When a theme block is flipped, it switches between poster theme mode and chroma theme mode
    this.patternBlocks.forEach(block => this._bindPatternBlock(block))
  }

  _bindNameInput() {
    this.nameInput.addEventListener('change', event => {
      this.theme.name = event.target.value
      CGC.saveThemes()
    })
  }

  _bindColorInput() {
    this.colorInput.addEventListener('input', event => {
      let elem = event.target,
        colorStr = elem.value

      if (!colorStr.match(Theme.COLOR_REG)) return  // illegal color string

      let idx = this.colorInputBox.dataset.idx
      let patternBlock = this.patternBlocks[idx]
      patternBlock.style['background-color'] = colorStr
      patternBlock.style['background-image'] = ''

      this.theme.setPattern(idx, colorStr)
      CGC.saveThemes()

      if (this.isSelected()) CGC.sendTheme(this.theme)
    })
  }

  _bindDelBtn() {
    this.delBtn.addEventListener('click', event => {
      if (!this.delBtnGroup.classList.contains('confirming')) {
        // first click, change style to ask for confirm
        this.delBtnGroup.classList.add('confirming')
      } else {
        // confirmed, delete it
        CGC.deleteTheme(this.theme)
        this.themeBlock.classList.add('deleted')    // display disappearance effect
        window.setTimeout(() => this.themeBlock.remove(), 500) // add a time delay to diplay the full deletion animation
      }
    })

    this.delCancelBtn.addEventListener('click', event => {
      this.delBtnGroup.classList.remove('confirming')
    })
  }

  _bindEditBtn() {
    this.editBtn.addEventListener('click', event => {
      // Toggling editing mode when click on the edit button
      let editing = this.themeBlock.classList.contains('editing')
      this.setEditMode(!editing)
    })
  }

  _bindFlipBtn() {
    /*
     *  @param: themeType { string }
     *    one of the keys of Theme.TYPES
     */
    function _setThemeTypeTxt(themeBlock, themeType) {
      themeBlock.dataset.typeName = themeType
      let cls = Theme.getClass(themeType),  
          txt = themeBlock.querySelector('.theme-type')

      switch (cls) {
        case ChromaTheme:
          txt.dataset['typeStr'] = 'Type: Chroma'
          break
        case PosterTheme:
          txt.dataset['typeStr'] = 'Type: Poster'
          break
        default:
          throw new RangeError(`Unknown theme type: '${themeType}'`)
      }
    }

    // get rotating mapping table
    // e.g. [1,2,3] => {1:2, 2:3, 3:1}
    let types = Object.keys(Theme.TYPES)
    let typeFilpMapping = {}
    for (let ind in types) {
      ind = parseInt(ind)
      typeFilpMapping[types[ind]] = types[ (ind + 1) % types.length ]
    }

    // bind event
    let tb = this.themeBlock

    addFlip(this.flipBtn, tb, () => {
      // modify the data
      let targetType = typeFilpMapping[tb.dataset.typeName]
      if (!targetType) throw new RangeError("Unknown type: " + tb.dataset.typeName)

      this.theme.setThemeType(targetType)
      _setThemeTypeTxt(tb, targetType)

      // change the theme on the page if the block is selected
      let selected = tb.classList.contains('selected')
      if (selected) CGC.sendTheme(theme)

      this.flipThemeTypeCb(targetType)
    })
  }

  _bindPatternBlock(block) {
    // .colorInput should follow the mouse as it enter a pattern block
    block.addEventListener('mouseenter', event => {
      let isEditing = this.themeBlock.classList.contains('editing'),
          cb = this.colorInputBox

      if (isEditing) {
        cb.style.left = (block.offsetLeft + block.offsetWidth / 2 - cb.offsetWidth / 2) + 'px'
        cb.dataset.idx = Math.round(block.offsetLeft / block.offsetWidth)

        let patternStr = this.theme.patterns[cb.dataset.idx]
        this.colorInput.value = patternStr.match(Theme.COLOR_REG) ? patternStr : '<icon>'
      }
    })
  }
}