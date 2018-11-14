/*
* @Author: gigaflw
* @Date:   2018-11-05 15:11:54
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-11-14 17:47:39
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
    if (patternStr.startsWith(CGC.presetIconDir) || patternStr.startsWith('data:image/')) patternType = 'icon'
    else if (patternStr.match(Theme.COLOR_REG)) patternType = 'color'
    else {
      console.error("CGC> Can not parse pattern string: " + patternStr)
    }

    return {
      color: `<div class="pattern-block" style="background-color: ${patternStr}"></div>`,
      icon: `<div class="pattern-block" style="background-image: url(${patternStr})"></div>`,
      none: `<div class="pattern-block">Error</div>`,
    }[patternType]
  }

  static getThemeBlock(theme) {
    let [patternBlocksStr, posterBlockStr, typeStr] = function() {
      let pat = theme.patterns || ChromaTheme.DEFAULT_PATTERNS,
          realPat = theme.patterns ? theme.getPatterns() : pat
          // pat are file identifiers, realPat are ready for css, they are always identical except for dataURL icons
      let posStr = theme.poster ?
        `<div style="background-image: url(${theme.getPoster()}), url(${PosterTheme.NOTFOUND_IMG})" title="${theme.poster}"></div>` :
        '<span>NONE</span>'
        // other css propoerties will be handled by popup.css

      let typeStr;
      if (theme instanceof ChromaTheme) {
        typeStr = 'Type: Chroma'
      } else if (theme instanceof PosterTheme) {
        typeStr = 'Type: Poster'
      }

      let patStr = realPat.reduce((acc, cur) => acc + ThemeManager.getPatternBlockStr(cur), '')
      patStr = `
        ${patStr}
        <div class="color-edit-box underline hidden" data-idx="0">
          <input class="invisible-input" type="text" disabled value="${pat[0].match(Theme.COLOR_REG) ? pat[0] : '<icon>'}">
        </div>`

      return [patStr, posStr, typeStr]
    }()

    let themeBlockHTML = `
    <div class="theme-block" data-theme-id="${theme.id}" data-type-name="${theme.type}">
      <div class="theme-type" data-type-str="${typeStr}"></div>
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
        <div class="editor-btn-group js-show-on-editing">
          <i class="js-flip-btn fa fa-btn fa-retweet" title="Switch between theme types"></i>
          <i class="js-more-btn fas fa-btn fa-ellipsis-h" title="Delete this theme"></i>
        </div>
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

    // identify components
    this.editBtn = tb.querySelector('.js-edit-btn')
    this.delBtnGroup = tb.querySelector('.js-del-btn-group')
    this.delBtn = tb.querySelector('.js-del-btn')
    this.delCancelBtn = tb.querySelector('.js-del-cancel-btn')
    this.flipBtn = tb.querySelector('.js-flip-btn')
    this.editorMoreBtn = tb.querySelector('.js-more-btn')
    this.nameInput = tb.querySelector('.theme-name input')
    this.colorInput = tb.querySelector('.color-edit-box input')
    this.colorInputBox = tb.querySelector('.color-edit-box')
    this.patternBlocks = Array.from(tb.querySelectorAll('.pattern-block'))
    this.patternBox = tb.querySelector('.theme-patterns')
    this.posterBox = tb.querySelector('.theme-poster')

    // init cbs
    this.initEventCbs()
  }

  // TODO: make the event cb system stronger
  // It is necessary because some events requires to communicate with some html elem outside the theme block
  //  e.g. galleries, palette, etc.
  // for now, for each need, I hardcode the event name/type/elem here,
  //  and add one more line to _bindXXXX to call the cb
  // I need a way to add arbitrary events to arbitary type ('click', 'input', etc.) to arbitary elem (editBtn, delBtn, etc.)
  initEventCbs() {
    this._cbs = {}
    let allowedEvents = [
      'colorInput', 'flipThemeType', 'clickPatternBlock',
      'enterEditMode', 'leaveEditMode'
    ]
    for (let key of allowedEvents) this._cbs[key] = () => {}
  }

  setEventCb(eventName, cb) {
    if (!this._cbs[eventName]) {
      console.error('Unknown manager event name: ' + eventName + '. Allowed: ' + Object.keys(this._cbs))
    }
    this._cbs[eventName] = cb
  }

  callEventCb(eventName, ...args) {
    this._cbs[eventName] && this._cbs[eventName].call(this, ...args)
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

    if (this.isEditing() === val) return

    if (val) { // entering edit mode
      // only 1 block can enter edit mode at once
      for (let manager of Object.values(CGC.managers)) {
        manager.setEditMode && manager.setEditMode(false)
      }

      this.themeBlock.classList.add('editing')

      this.editBtn.classList.add('activated')

      this.colorInput.disabled = this.nameInput.disabled = false  // editable
      this.nameInput.focus()

      this.callEventCb('enterEditMode')

    } else { // leave edit mode

      this.themeBlock.classList.remove('editing')

      this.editBtn.classList.remove('activated')

      this.colorInput.disabled = this.nameInput.disabled = true // non-editable

      this.callEventCb('leaveEditMode')
    }
  }

  isEditing() {
    return this.themeBlock.classList.contains('editing')
  }

  isChroma() { return this.theme instanceof ChromaTheme }

  isPoster() { return this.theme instanceof PosterTheme }

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
   * Set one of the patterns to be icon
   * @param { Int } ind
   *    The index of the pattern block to be modified
   * @param { String } iconLabel
   *    The label for the icon to be saved into Theme
   *    For predefined icons, it is the file path
   *    For user-uploaded icons (which stored as probably long dataurl), it is the icon id
   * @param { String } cssStr
   *    The value which can be directly used as css
   */
  setPatternToIcon(ind, iconLabel, cssStr) {
    this.theme.setPattern(ind, iconLabel)

    let pb = this.patternBlocks[ind]
    pb.style['background-color'] = ''
    pb.style['background-image'] = cssStr

    if (ind === this.getEditingPatternBlockIdx()) this.colorInput.value = '<icon>'

    CGC.saveThemes()
    if (this.isSelected()) CGC.sendTheme(this.theme)

    this.callEventCb('patternChanged', ind, iconLabel)
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

  setPoster(backgoundImgUrl, attrs={}) {
    // can not do tag changing and background setting together because the "//" in url will get censored
    this.posterBox.innerHTML = "<div></div>"
    let elem = this.posterBox.firstElementChild

    elem.style = `background-image: ${backgoundImgUrl}`
    for (let key in attrs) elem.setAttribute(key, attrs[key])
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
    this._bindEditorMoreBtn()   // show galleries
    this.patternBlocks.forEach((block, ind) => this._bindPatternBlock(block, ind))
    return this
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

      this.callEventCb('colorInput', idx, colorStr)
    })
  }

  _bindDelBtn() {
    this.delBtn.addEventListener('click', event => {
      event.stopPropagation()

      if (!this.delBtnGroup.classList.contains('confirming')) {
        // first click, change style to ask for confirm
        this.delBtnGroup.classList.add('confirming')
      } else {
        // confirmed, delete it
        this.setEditMode(false)
        CGC.deleteTheme(this.theme)
        this.themeBlock.classList.add('deleted')    // display disappearance effect
        window.setTimeout(() => this.themeBlock.remove(), 500) // add a time delay to diplay the full deletion animation
      }
    })

    this.delCancelBtn.addEventListener('click', event => {
      event.stopPropagation()
      this.delBtnGroup.classList.remove('confirming')
    })
  }

  _bindEditBtn() {
    this.editBtn.addEventListener('click', event => {
      event.stopPropagation()
      // Toggling editing mode when click on the edit button
      let editing = this.themeBlock.classList.contains('editing')
      this.setEditMode(!editing)
      if (editing) this.themeBlock.parentElement.classList.remove('show-extended-editor') // see _bindEditorMoreBtn
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
          txt.dataset.typeStr = 'Type: Chroma'
          break
        case PosterTheme:
          txt.dataset.typeStr = 'Type: Poster'
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
      if (selected && !(this.isPoster() && !this.theme.poster)) CGC.sendTheme(this.theme)

      this.callEventCb('flipThemeType', targetType)
    })
  }

  _bindEditorMoreBtn() {
    this.editorMoreBtn.addEventListener('click', event => {
      event.stopPropagation()

      let activated = this.themeBlock.parentElement.classList.toggle('show-extended-editor')
    })
  }

  _bindPatternBlock(block, blockInd) {
    // .colorInput should follow the mouse as it enter a pattern block
    block.addEventListener('mouseenter', event => {
      if (this.isEditing()) {
        let cb = this.colorInputBox
        cb.dataset.idx = blockInd

        let patternStr = this.theme.patterns[cb.dataset.idx]
        this.colorInput.value = patternStr.match(Theme.COLOR_REG) ? patternStr : '<icon>'

        // calc colorInput position by pattern block positions
        // |  p1  |  p2  |  p3  |  p4  |  p5
        // x0       xcb   xcenter
        let pN = this.patternBlocks.length,
            pW = block.offsetWidth,
            x0 = this.patternBlocks[0].offsetLeft,
            xcenter = x0 + pN * pW / 2,
            xcb = block.offsetLeft + pW / 2

        // shrink when blockInd leaves the center of the blocks, so that the colorInput do not move away too much, 
        let shrinkRatio = Math.abs(blockInd / (pN-1) - 0.5) * 1.4
        xcb = xcb * shrinkRatio + xcenter * (1 - shrinkRatio)
        cb.style.left = (xcb - cb.offsetWidth / 2) + 'px'
      }
    })

    block.addEventListener('click', event => {
      this.callEventCb('clickPatternBlock', this.colorInputBox.dataset.idx, block)
    })
  }
}