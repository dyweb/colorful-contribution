/*
* @Author: gigaflw
* @Date:   2018-09-05 08:11:35
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-11-09 13:35:41
*/

/*
 * There are two types of theme for now: ChromaTheme (those of colors and icons) and PosterTheme (those of a poster)
 * Inheritance chain:
 *   Theme --> ChromaTheme
 *         \-> PosterTheme
 * When Theme#setThemeType is called, the instance's `__proto__`
 *   is redirected to the `prototype` of the corresponding subclass
 */
class Theme {
  static getId() {
    let ret = Theme.nextId++
    chrome.storage.sync.set({'next_theme_id': Theme.nextId})
    return ret
  }

  // private
  constructor(id, name, type) {
    if (!Number.isInteger(id)) {
      if (id !== null) console.warn(`Theme> Tend to use invalid value ${id} as theme id, ignored`)
      id = Theme.getId()
    }
    this.id = id
    this.name = name
    this.type = type
    this.thresholds = Theme.DETECTED_THRESHOLDS
      // use `DETECTED_THRESHOLDS even if `Theme.detectContribLevelThresholds` is yet to be called
      // this will ensure content script can know it should detect the thresholds
      // according to the special value of theme.thresholds in sent themes
      // Theme.DEFAULT_THRESHOLDS is only used when some error happens
  }

  static createFrom(theme) {
    let th = theme.copy()
    th.id = Theme.getId()
    return th
  }

  /*
   * @parameter: type { String }
   *   one of value stored in Theme.TYPES
   * The `__proto__` of the instance will be changed
   */
  setThemeType(type) {
    this.type = type.toLowerCase()
    this.__proto__ = Theme.getClass(this.type).prototype
    this.setDefault()
  }

  setThresholds(thresholds) { this.thresholds = thresholds; return this }

  static getClass(themeType) {
    if (Theme.TYPES.hasOwnProperty(themeType)) {
      return Theme.TYPES[themeType]
    } else {
      throw new RangeError("Unknown theme type: " + themeType)
    }
  }

  getClass() { return Theme.getClass(this.type) }

  copy() { throw new Error('virtual function called') }

  /*
   * Used when being injected with content script
   */
  toObject() { throw new Error('virtual function called') }

  /*
   * Convert an object into instance.
   * This function will delegate to subclasses.
   */
  static fromObject(obj) {
    let theme = Theme.getClass(obj.type).fromObject(obj)
    theme.validate()
    return theme
  }

  validateField(field, pred=null) {
    let pred_ = pred ? (val => (val && pred(val))) : (val => val)
    if (!pred_(this[field])) throw new Error(`Theme> A theme obj is required to have \`${field}\` field. Given: ${Object.entries(this.toObject())}`)
  }

  validate() {
    this.validateField('id')
    this.validateField('name')
    this.validateField('type')
    this.validateField('thresholds', thre => thre.length > 0)
  }

  /*
   * Theme instances are designed to be able to switch between subclasses
   * So we need a functoin to set all the default value for the subclass-specific properties
   * Notice that the old values are not forced to be discarded
   */
  setDefault() { }

  static detectContribLevelThresholds() {
    if (Theme._THRESHOLDS_DETECTED) return Theme.DETECTED_THRESHOLDS

    // 'rgb(0, 16, 255)' => '#0010FF'
    function _rgbToHex(rgbColorStr) {
      let match = rgbColorStr.match(/rgb\((\w+),?\s*(\w+),?\s*(\w+),?\s*\)/)
      if (!match) throw new Error("Theme> Can not parse color string: " + rgbColorStr)
      let rgb = match.slice(1, 4).map(n => ('0' + parseInt(n).toString(16)).slice(-2))
      return '#' + rgb.join('')
    }

    let colors = document.querySelectorAll('ul.legend > li')
    colors = Array.from(colors).map(elem => _rgbToHex(elem.style['background-color']))

    let days = document.querySelectorAll('rect.day')
    let thresholds = []
    colors.forEach(_ => thresholds.push([undefined, undefined])) // min, max (inclusive)

    days.forEach(elem => {
      let count = parseInt(elem.dataset['count'])
      let color = elem.getAttribute('fill')
      if (color.match(/^#[0-9a-zA-Z]{3}$/)) {
        // e.g. #123 => #112233
        color = Array.from(color).map((ch, ind) => ch == '#' ? '#' : ch.repeat(2)).join('')
      }
      if(!color.match(/^#[0-9a-zA-Z]{6}$/)) throw new Error("Theme> Can not parse color string: " + color)
      if(!colors.includes(color)) throw new Error(`Theme> Can not determine color ${color} from ${colors}`)

      let colorInd = colors.indexOf(color)
      let [min, max] = thresholds[colorInd]
      thresholds[colorInd][0] = min ? Math.min(min, count) : count
      thresholds[colorInd][1] = max ? Math.max(max, count) : count
    })

    Theme._THRESHOLDS_DETECTED = true
    Theme.DETECTED_THRESHOLDS = thresholds
    return thresholds
  }

   /*
   * Calculate the mapping between the contribution count and the color level.
   * However, this is not open according to
   *   'https://stackoverflow.com/questions/19712159/github-contribution-histograms'
   * We choose to circumvent this by detecting the thresholds dynamically from html.
   *
   * @param: cnt { Integer }
   * @return { Integer }
   *    will return a value in {0, 1, 2, 3, 4}, 0 denotes the lowest level (should use the plainest color)
   */
  _contribCntToInd(cnt) {
    let thresholds = this.thresholds

    if (thresholds == '<to_be_detected>') {
      console.error("Tried to determine contribution ranges but no thresholds have been detected!")
      thresholds = Theme.DEFAULT_THRESHOLDS
    }

    for (let ind in thresholds) {
      let [min, max] = thresholds[ind]
      if (min <= cnt && cnt <= max) return ind
    }

    console.error(`Can not determine the color for contribution count ${cnt} according to thresholds: ${this.thresholds}`)
    return 0
  }

  /*
   * Modify the legend elements accoding to the theme
   *
   * @param: contribChart: the whole contributiion chart svg element
   *   For now, it can be get by document.querySelector('.js-yearly-contributions')
   */
  setHTMLLegends(contribChart) { throw new Error('virtual function called') }

  /*
   * Modify the day blocks accoding to the theme
   *
   * @param: contribChart: the whole contributiion chart element
   *   For now, it can be get by document.querySelector('.js-yearly-contributions')
   */
  setHTMLDayBlocks(contribChart) { throw new Error('virtual function called') }

  /*
   * Recover the html so that another theme can be inserted
   * @param: themeTypeUnchanged { bool }
   *   whether or not the html is cleaned for a theme of the same theme type
   *   possibly less clean work for same theme type
   * This function will delegate to subclasses.
   */
  static clean(contribChart, themeType, themeTypeUnchanged) {
    this.getClass(themeType).clean(contribChart, themeTypeUnchanged)
  }
}

// thresholds will be detected when `CGC.detectContribLevelThresholds` is triggered
// There will be two case
//  case 1:
//    Theme.DETECTED_THRESHOLDS is the initial value "<to_be_detected>"
//    when content script is executed, it will see this special value in the sent theme and
//    call Theme.detectContribLevelThresholds to detect the thresholds,
//    which will change Theme.DETECTED_THRESHOLDS into the detected value
//  case 2:
//     Theme.DETECTED_THRESHOLDS has already been changed. Directly use the value
Theme.DEFAULT_THRESHOLDS = [[0, 0], [1, 5], [6, 10], [11, Number.POSITIVE_INFINITY]]
Theme.DETECTED_THRESHOLDS = "<to_be_detected>"
Theme.nextId = 0
Theme.COLOR_REG = /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$|^rgb\(\w+,?\s*\w+,?\s*\w+\s*\)$|^hsl\(\w+,?\s*\w+(\.\w+)?\%,?\s*\w+(\.\w+)?\%\s*\)$/
  // e.g. '#1ad', '#11AAdd', `rgb(1,2,3)', 'hsl(1, 1%, 2%)'

class ChromaTheme extends Theme {
  constructor(name, id=null) { super(id, name, ChromaTheme.TYPE_STR) }

  setPattern(ind, pattern) {
    if (!this.patterns) this.patterns = []
    this.patterns[ind] = pattern
    return this
  }
  setPatterns(patterns) { this.patterns = patterns; return this }

  setDefault() { this.setPatterns(ChromaTheme.DEFAULT_PATTERNS) }

  copy() { return new ChromaTheme(this.name, this.id).setThresholds(this.thresholds).setPatterns(this.patterns) }

  toObject() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      thresholds: this.thresholds,
      patterns: this.patterns
    }
  }

  static fromObject(obj) {
    let theme = new ChromaTheme(obj.name, obj.id).setThresholds(obj.thresholds).setPatterns(obj.patterns)
    theme.validate()
    return theme
  }

  validate() {
    super.validate()
    this.validateField('patterns', pat => pat.length > 0)
  }

  /*
   * There are three type of patterns which we can put into a day block:
   * 1. solid color
   *   e.g. #ffffff
   * 2. icon file
   *   e.g. icons/foo.png
   * 3. data url
   *   e.g. data:image/XXXX
   *
   * This function will parse the pattern string and return the type constant
   */
  static getPatternType(pattern) {
    if (!ChromaTheme._PATTERN_TYPE_DEFINED) {
      ChromaTheme.PATTERN_TYPE_COL = 'color'
      ChromaTheme.PATTERN_TYPE_ICO = 'icon'
      ChromaTheme.PATTERN_TYPE_DAT = 'dataURL'
      ChromaTheme._PATTERN_TYPE_DEFINED = true
    }

    if (pattern.startsWith('icons/')) {
      return ChromaTheme.PATTERN_TYPE_ICO
    } else if (pattern.startsWith('data:image/')) {
      return ChromaTheme.PATTERN_TYPE_DAT
    } else if (pattern.match(Theme.COLOR_REG)) {
      return ChromaTheme.PATTERN_TYPE_COL
    }
  }

  setHTMLLegends(contribChart) {
    let legends = contribChart.querySelectorAll('.contrib-legend ul.legend > li')

    // Check for the number of legends
    if (legends.length != this.patterns.length) {
      throw new Error('ChromaTheme> There are ' + legends.length + ' legends but ' + this.patterns.length + ' theme')
    }

    for (let ind = 0; ind < legends.length; ++ind) {
      let [pat, leg] = [ this.patterns[ind], legends[ind] ]
      let css = null

      switch (ChromaTheme.getPatternType(pat)) {
        case ChromaTheme.PATTERN_TYPE_COL:
          css = {
            'background-color': pat,
            'background-image': ''
          }
          break
        case ChromaTheme.PATTERN_TYPE_ICO:
          css = {
            'background-color': '',
            'background-image': `url(${chrome.extension.getURL(pat)})`,
          }
          break
        case ChromaTheme.PATTERN_TYPE_DAT:
          css = {
            'background-color': '',
            'background-image': `url(${pat})`,
          }
          break
        default:
          throw new Error("ChromaTheme> Can not parse pattern: " + pat)
      }


      for (let key in css) {
        leg.style[key] = css[key]
      }
    }
  }

  setHTMLDayBlocks(contribChart) {
    let days = contribChart.querySelectorAll('.calendar-graph rect.day')

    for (let rectElem of days) {
      let _pat_ind = this._contribCntToInd(rectElem.dataset.count)
      let pattern = this.patterns[_pat_ind]

      let _prev = rectElem.previousElementSibling
      let imgElem = (_prev && _prev.matches('image')) ? _prev : null

      // each day block now can be one of the
      // 1. <rect class="day"></rect>, same as the github default, except for possible color alteration
      // 2. <image></image><rect class="day"></rect>, 2 elements
      //  the upper layer `rect` is used to triggle events and should be set to transparent
      let _is_ico = false
      switch (ChromaTheme.getPatternType(pattern)) {
        case ChromaTheme.PATTERN_TYPE_COL:
          rectElem.setAttribute('fill', pattern)
          if (imgElem) rectElem.parentNode.removeChild(imgElem)  // remove useless image block
          break

        case ChromaTheme.PATTERN_TYPE_ICO:
          _is_ico = true // no break
        case ChromaTheme.PATTERN_TYPE_DAT:
          let href = _is_ico ? chrome.extension.getURL(pattern) : pattern

          rectElem.setAttribute('fill', 'transparent')
          if (imgElem) {
            imgElem.setAttribute('href', href)
          } else {
            let img = rectElem.cloneNode()
            img.setAttribute('href', href)
            rectElem.parentNode.insertBefore(img, rectElem)
            img.outerHTML = img.outerHTML.replace('rect', 'image')  // this is the <image> tag in svg, not the <img> in html
          }
          break

        default:
          throw new Error("ChromaTheme> Can not parse pattern: " + pat)
      }
    }
  }

  static clean(contribChart, themeTypeUnchanged) {
    if (themeTypeUnchanged) return

    let days = contribChart.querySelectorAll('.calendar-graph rect.day')
    for (let rectElem of days) {
      let prev = rectElem.previousElementSibling
      if (prev && prev.matches('image')) rectElem.parentNode.removeChild(prev)
    }
  }
}

class PosterTheme extends Theme {
  constructor(name, id=null) { super(id, name, PosterTheme.TYPE_STR) }

  setPoster(poster) { this.poster = poster; return this }

  copy() { return new PosterTheme(this.name, this.id).setThresholds(obj.thresholds).setPoster(this.poster) }

  toObject() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      thresholds: this.thresholds,
      poster: this.poster
    }
  }

  static fromObject(obj) {
    let theme = new PosterTheme(obj.name, obj.id).setThresholds(obj.thresholds).setPoster(obj.poster)
    theme.validate()
    return theme
  }

  validate() {
    super.validate()
    this.validateField('poster')
  }

  /*
   * There are three types of posters which we can put into a day block:
   * 1. an image file from extension folder
   *   e.g. posters/foo.png
   * 2. url, either from network or dataurl (this tends to be very large)
   *   we only store the id in the property, need to be retrieved from storage when using
   *   e.g. url:<some_id>
   * This function will parse the pattern string and return the type constant
   */
  static getPosterType(poster) {
    if (!PosterTheme._POSTER_TYPE_DEFINED) {
      PosterTheme.POSTER_TYPE_NONE = 'none'
      PosterTheme.POSTER_TYPE_IMG = 'image'
      PosterTheme.POSTER_TYPE_URL = 'url' // may be web url or dataURL
      PosterTheme._POSTER_TYPE_DEFINED = true
    }

    if (poster.startsWith('posters/')) {
      return PosterTheme.POSTER_TYPE_IMG
    } else if (poster.startsWith('url:')) { // this special header should be given by the code from the gallery part
      return PosterTheme.POSTER_TYPE_URL
    } else {
      return PosterTheme.POSTER_TYPE_NONE
    }
  }

  getPosterUrl() {
    switch (PosterTheme.getPosterType(this.poster)) {
      case PosterTheme.POSTER_TYPE_IMG: return chrome.extension.getURL(this.poster)
      case PosterTheme.POSTER_TYPE_URL: return this._retrieved_poster_url
        // will be null if `waitForStorageCallback` haven't been called
      default: throw new Error("PosterTheme> Can not parse poster: " + this.poster)
    }
  }

  waitForStorageCallback(cb) {
    if (PosterTheme.getPosterType(this.poster) != PosterTheme.POSTER_TYPE_URL || this._retrieved_poster_url) {
      return false // do not need to wait
    }

    let fileId = this.poster.slice(4) // remove leading 'url:'
    chrome.storage.local.get({'CGC_upload_posters': []}, obj => {
      let uploaded = obj['CGC_upload_posters'] // something like [[<id>, <dataurl>], [<id>, <dataurl>], ...]
      let result = uploaded.find(([id, url]) => id == fileId)
      if (!result) {
        console.warn("Unknown poster: " + this.poster)
        this._retrieved_poster_url = null
      } else {
        this._retrieved_poster_url = result[1] // will be used by `getPosterUrl`
      }

      cb()
    })
    return true
  }


  setHTMLLegends(contribChart) {
    let cb = this.setHTMLLegends.bind(this, contribChart) // call itself again
    if (this.waitForStorageCallback(cb)) return
      // wait for storage retrieval, which happens when `this.poster` is an identifier pointing to the storage
      // this function will be called again when that is ready

    let legends = contribChart.querySelectorAll('.contrib-legend ul.legend > li')

    for (let ind = 0; ind < legends.length; ++ind) {
      let [leg, alpha] = [ legends[ind], PosterTheme._ALPHAS[ind] ]
      let x = ind * 15

      let css = {
        'opacity': `${alpha}`,
        'background-image': `url(${this.getPosterUrl()})`,
        'background-position': `${x}% center`,
        'background-size': `auto 200%`  // twice the height of the legend
      }
      for (let key in css) {
        leg.style[key] = css[key]
      }
    }
  }

  setHTMLDayBlocks(contribChart) {
    let cb = this.setHTMLDayBlocks.bind(this, contribChart) // call itself again
    if (this.waitForStorageCallback(cb)) return
      // wait for storage retrieval, which happens when `this.poster` is an identifier pointing to the storage
      // this function will be called again when that is ready

    let svg = contribChart.querySelector('svg.js-calendar-graph-svg')

    // enlarge the blocks to make the poster more visible
    Array.from(svg.querySelectorAll('rect.day')).forEach(elem => {
      elem.setAttribute('width', 12)
      elem.setAttribute('height', 12)
    })

    // insert our poster
    // in svg, must use namespace-awared createElementNS instead of createElement
    let [svgW, svgH] = [svg.getAttribute('width'), svg.getAttribute('height')]
    let blockGroup = svg.querySelector('g') // first <g> element, will be set to transparent, but keep this elem to keep mouse events
    let [transW, transH] = blockGroup.getAttribute('transform').split(/[(,)\s]/).filter(x => x.match(/[0-9]+/)) // "translate(16, 20)" => [16, 20]

    let posterGroup = document.createElementNS("http://www.w3.org/2000/svg", "g")
    posterGroup.id = PosterTheme._POSTERID
    posterGroup.innerHTML = `
      <mask id="${PosterTheme._MASKID}"></mask>
      <image
        href="${this.getPosterUrl()}"
        transform="translate(${transW}, ${transH})"
        width="${svgW-transW}" height="${svgH-transH}"
        mask="url(#${PosterTheme._MASKID})" preserveAspectRatio="xMidYMid slice"
      >
      </image>
    `

    posterGroup.querySelector('mask').innerHTML = blockGroup.outerHTML // copy the element
    let maskGroup = posterGroup.querySelector('mask g')
    for (let text of maskGroup.querySelectorAll('text')) { maskGroup.removeChild(text) }
    maskGroup.setAttribute('transform', 'translate(0, 0)') // nullify translate compensated by texts

    // TODO: a complete clone may be expensive
    //  but here is a dilemma:
    //    we need the day blocks on the upper layer (thus, appear after the mask element in html)
    //    to trigger click/hover events, and in the same time, being transparent
    //    and we also need the day blocks to appear before the mask in html
    //    to use the blocks as mask src
    svg.insertBefore(posterGroup, blockGroup) // blockGroup needs to be the latter to be on the upper layer

    // set the upper layer to be transparent
    let days = blockGroup.querySelectorAll('.calendar-graph rect.day')
    days.forEach(rectElem => rectElem.setAttribute('fill', 'transparent'))

    let maskDays = maskGroup.querySelectorAll('.calendar-graph rect.day')
    for (let rectElem of maskDays) {
      let ind = this._contribCntToInd(rectElem.dataset.count),
          alpha = PosterTheme._ALPHAS[ind],
          colorStr = '#' + Math.round(alpha * 255).toString(16).repeat(3)
      rectElem.setAttribute('fill', colorStr)
    }

  }

  static clean(contribChart, themeTypeUnchanged) {
    let posterGroup = contribChart.querySelector(`#${PosterTheme._POSTERID}`)
    if (posterGroup) posterGroup.parentNode.removeChild(posterGroup)

    Array.from(contribChart.querySelectorAll('rect.day')).forEach(elem => {
      elem.setAttribute('width', 10)
      elem.setAttribute('height', 10)
    })
  }

  /*
   * Check whether a url is valid as poster image using regex
   * @return: { Null | String }
   *   return the prompt if invalid, other wise nothing
   */
  static checkWebURL(url) {
    if (!['http://', 'https://'].some(str => url.startsWith(str))) {
      return 'url should begin with "http://" or "https://'
    } else if (!PosterTheme._WEB_SUFFIXES.some(str => url.endsWith(str))) {
      return `url should end with one of "${PosterTheme._WEB_SUFFIXES.join('", "')}"`
    }
  }
}

ChromaTheme.DEFAULT_PATTERNS = [...Array(5)].map(_ => '#eee')

PosterTheme._POSTERID = "_CGC-poster", // use leading underscore to denote privateness
PosterTheme._MASKID = "_CGC-poster-mask"
PosterTheme._ALPHAS = [ 0.4, 0.55, 0.7, 0.85, 1.0 ] // transparency constants
PosterTheme._WEB_SUFFIXES = ['png', 'jpg', 'jpeg', 'webp', 'bmp']
PosterTheme._WEB_URL_REG = new RegExp('https?:\/\/.*\.(?:' + PosterTheme._WEB_SUFFIXES.join('|') + ')', 'i')
PosterTheme.NOTFOUND_IMG = "notfound.png"

ChromaTheme.TYPE_STR = 'chroma'
PosterTheme.TYPE_STR = 'poster'

Theme.TYPES = {
  [ChromaTheme.TYPE_STR]: ChromaTheme,
  [PosterTheme.TYPE_STR]: PosterTheme,
}
