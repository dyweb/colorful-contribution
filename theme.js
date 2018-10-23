/*
* @Author: gigaflw
* @Date:   2018-09-05 08:11:35
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-10-23 22:01:56
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
  // private
  constructor(name, type) {
    this.name = name
    this.type = type
    this.thresholds = Theme.DEFAULT_THRESHOLDS
  }

  /*
   * @parameter: type { String }
   *   one of value stored in Theme.TYPES
   * The `__proto__` of the instance will be changed
   */
  setThemeType(type) {
    this.type = type.toLowerCase()
    this.__proto__ = Theme.getClass(this.type).prototype
  }

  setThresholds(thresholds) { this.thresholds = thresholds; return this }

  static getClass(themeType) {
    if (Theme.TYPES.hasOwnProperty(themeType)) {
      return Theme.TYPES[themeType]
    } else {
      console.error("Unknown theme type: " + themeType)
    }
  }

  getClass() { return Theme.getClass(this.type) }

  copy() { console.error('virtual function called') }

  /*
   * Used when being injected with content script
   */
  toObject() { console.error('virtual function called') }

  /*
   * Convert an object into instance.
   * This function will delegate to subclasses.
   */
  static fromObject(obj) {
    let _checkStr = field =>  `Parsed failed. A theme obj is required to have \`${field}\` field. Given: ${Object.entries(obj)}`

    console.assert(obj.name, _checkStr('name'))
    console.assert(obj.type, _checkStr('type'))
    console.assert(obj.thresholds && obj.thresholds.length > 0, _checkStr('thresholds'))
    return Theme.getClass(obj.type).fromObject(obj)
  }

  _contribCntToInd(cnt) {
    let ind = cnt && this.thresholds.findIndex(th => th >= cnt) // TODO: the real mapping is more complicated
    if (ind < 0) ind = this.thresholds.length - 1
    return ind
  }

  /*
   * Modify the legend elements accoding to the theme
   *
   * @param: contribChart: the whole contributiion chart svg element
   *   For now, it can be get by document.querySelector('.js-yearly-contributions')
   */
  setHTMLLegends(contribChart) { console.error('virtual function called') }

  /*
   * Modify the day blocks accoding to the theme
   *
   * @param: contribChart: the whole contributiion chart element
   *   For now, it can be get by document.querySelector('.js-yearly-contributions')
   */
  setHTMLDayBlocks(contribChart) { console.error('virtual function called') }

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

Theme.DEFAULT_THRESHOLDS = null

class ChromaTheme extends Theme {
  constructor(name) { super(name, ChromaTheme.TYPE_STR) }

  setPattern(ind, pattern) {
    if (!this.patterns) this.patterns = []
    this.patterns[ind] = pattern
    return this
  }
  setPatterns(patterns) { this.patterns = patterns; return this }

  copy() { return new ChromaTheme(this.name).setThresholds(this.thresholds).setPatterns(this.patterns) }

  toObject() {
    return {
      name: this.name,
      type: this.type,
      thresholds: this.thresholds,
      patterns: this.patterns
    }
  }

  static fromObject(obj) {
    console.assert(obj.patterns && obj.patterns.length > 0, "Parsed failed. A chroma theme obj is required to have `patterns`. Given: ", obj)
    return new ChromaTheme(obj.name).setThresholds(obj.thresholds).setPatterns(obj.patterns)
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

    if (pattern.startsWith('#')) {
      return ChromaTheme.PATTERN_TYPE_COL
    } else if (pattern.startsWith('icons/')) {
      return ChromaTheme.PATTERN_TYPE_ICO
    } else if (pattern.startsWith('data:image/')) {
      return ChromaTheme.PATTERN_TYPE_DAT
    }
  }

  setHTMLLegends(contribChart) {
    let legends = contribChart.querySelectorAll('.contrib-legend ul.legend > li')

    // Check for the number of legends
    if (legends.length != this.patterns.length) {
      console.error('There are ' + legends.length + ' legends but ' + this.patterns.length + ' theme')
      return
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
          console.error("Can not parse pattern: ", pat)
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
          console.error("Can not parse pattern: ", pat)
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
  constructor(name) { super(name, PosterTheme.TYPE_STR) }

  setPoster(poster) { this.poster = poster; return this }

  copy() { return new PosterTheme(this.name).setThresholds(obj.thresholds).setPoster(this.poster) }

  toObject() {
    return {
      name: this.name,
      type: this.type,
      thresholds: this.thresholds,
      poster: this.poster
    }
  }

  static fromObject(obj) {
    console.assert(obj.poster, "Parsed failed. A poster theme obj is required to have `poster`. Given: ", obj)
    return new PosterTheme(obj.name).setThresholds(obj.thresholds).setPoster(obj.poster)
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
      PosterTheme.POSTER_TYPE_IMG = 'image'
      PosterTheme.POSTER_TYPE_URL = 'url' // may be web url or dataURL
      PosterTheme._POSTER_TYPE_DEFINED = true
    }

    if (poster.startsWith('posters/')) {
      return PosterTheme.POSTER_TYPE_IMG
    } else if (poster.startsWith('url:')) { // this special header should be given by the code from the gallery part
      return PosterTheme.POSTER_TYPE_URL
    }
  }

  getPosterUrl() {
    switch (PosterTheme.getPosterType(this.poster)) {
      case PosterTheme.POSTER_TYPE_IMG: return chrome.extension.getURL(this.poster)
      case PosterTheme.POSTER_TYPE_URL: return this._retrieved_poster_url
        // will be null if `waitForStorageCallback` haven't been called
      default: console.error("Can not parse poster: " + this.poster)
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
      if (!result) console.warn("Unknown poster: " + this.poster)

      this._retrieved_poster_url = result[1] // will be used by `getPosterUrl`
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
      let [leg, alpha] = [ legends[ind], PosterTheme._LEGEND_ALPHAS[ind] ]
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
      let ind = this._contribCntToInd(rectElem.dataset.count)
      rectElem.setAttribute('fill', PosterTheme._MASK_COLORS[ind])
    }

  }

  static clean(contribChart, themeTypeUnchanged) {
    let posterGroup = contribChart.querySelector(`#${PosterTheme._POSTERID}`)
    if (posterGroup) posterGroup.parentNode.removeChild(posterGroup)
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

PosterTheme._POSTERID = "_CGC-poster", // use leading underscore to denote privateness
PosterTheme._MASKID = "_CGC-poster-mask"
PosterTheme._MASK_COLORS = ['#333', '#666', '#999', '#ccc','#fff'] // white -> visible for html blocks
PosterTheme._LEGEND_ALPHAS = [ 0.2, 0.4, 0.6, 0.8, 1.0 ] // transparency for legends
PosterTheme._WEB_SUFFIXES = ['png', 'jpg', 'jpeg', 'webp', 'bmp']
PosterTheme._WEB_URL_REG = new RegExp('https?:\/\/.*\.(?:' + PosterTheme._WEB_SUFFIXES.join('|') + ')', 'i')

ChromaTheme.TYPE_STR = 'chroma'
PosterTheme.TYPE_STR = 'poster'

Theme.TYPES = {
  [ChromaTheme.TYPE_STR]: ChromaTheme,
  [PosterTheme.TYPE_STR]: PosterTheme,
}
