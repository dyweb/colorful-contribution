/*
* @Author: gigaflw
* @Date:   2018-09-05 08:11:35
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-10-18 11:36:51
*/

/*
 * There are two types of theme for now: ChromaTheme (those of colors and icons) and PosterTheme (those of a poster)
 * The fact that the we need to shift from one type to another type
 *   leads me to write this awesome subclass system (in the sense of the degree of stink).
 * In short, every instance is of `Theme` class, with `this.type` to denote its type.
 * We have distinct methods in subclasses `_ChromaTheme` and `_PosterTheme`,
 *   but they are all static and should be called by e.g. `_ChromaTheme.somemethod.call(theme, ...args)`
 */
class Theme {
  constructor(name, type) {
    this.name = name
    this.setThemeType(type)
    this.thresholds = Theme.DEFAULT_THRESHOLDS
  }

  setThemeType(type) {
    type = type.toLowerCase()
    console.assert([Theme.CHROMA_TYPE, Theme.POSTER_TYPE].includes(type), "Unknown theme type: " + type)
    this.type = type
  }

  setThresholds(thresholds) { this.thresholds = thresholds; return this }
  setPattern(ind, pattern) {
    if (!this.patterns) this.patterns = []
    this.patterns[ind] = pattern
    return this
  }
  setPatterns(patterns) { this.patterns = patterns; return this }
  setPoster(poster) { this.poster = poster; return this }

  static _getClass(themeType) {
    switch (themeType) {
      case Theme.CHROMA_TYPE: return _ChromaTheme
      case Theme.POSTER_TYPE: return _PosterTheme
      default: console.error("Unknown theme type: " + themeType)
    }
  }

  getClass() { return Theme._getClass(this.type) }

  copy() {
    return new Theme(this.name, this.type).setPatterns(this.patterns).setPoster(this.poster)
  }

  /*
   * Used when being injected with content script
   */
  toObject() {
    let ret = {
      name: this.name,
      type: this.type,
      thresholds: this.thresholds,
    }
    if (this.type == Theme.CHROMA_TYPE) ret['patterns'] = this.patterns
    if (this.type == Theme.POSTER_TYPE) ret['poster'] = this.poster
    return ret
  }

  static fromObject(obj) {
    console.assert(obj.name, "Parsed failed. A theme obj is required to have `name` field. Given: ", obj)
    console.assert(obj.thresholds && obj.thresholds.length > 0, "Parsed failed. A theme obj is required to have `thresholds` field. Given: ", obj)
    console.assert(obj.poster || (obj.patterns && obj.patterns.length > 0), "Parsed failed. A theme obj is required to have `patterns` or `poster` field. Given: ", obj)
    let type = obj.type || (obj.poster ? Theme.POSTER_TYPE : Theme.CHROMA_TYPE)

    let theme = new Theme(obj.name, type).setThresholds(obj.thresholds)
    if (obj.patterns) theme.setPatterns(obj.patterns)
    if (obj.poster) theme.setPoster(obj.poster)
    return theme
  }

  _contribCntToInd(cnt) {
    let ind = cnt && this.thresholds.findIndex(th => th >= cnt) // TODO: the real mapping is more complicated
    if (ind < 0) ind = this.thresholds.length - 1
    return ind
  }

  _delegate(funcName, ...args) { return this.getClass()[funcName].call(this, ...args) }

  /*
   * Modify the legend elements accoding to the theme
   *
   * @param: contribChart: the whole contributiion chart svg element
   *   For now, it can be get by document.querySelector('.js-yearly-contributions')
   */
  setHTMLLegends(contribChart) { return this._delegate('setHTMLLegends', contribChart) }

  /*
   * Modify the day blocks accoding to the theme
   *
   * @param: contribChart: the whole contributiion chart element
   *   For now, it can be get by document.querySelector('.js-yearly-contributions')
   */
  setHTMLDayBlocks(contribChart) { return this._delegate('setHTMLDayBlocks', contribChart) }

  /*
   * Recover the html so that another theme can be inserted
   * @param: themeTypeUnchanged { bool }
   *   whether or not the html is cleaned for a theme of the same theme type
   *   possibly less clean work for same theme type
   */
  static clean(contribChart, themeType, themeTypeUnchanged) {
    this._getClass(themeType).clean(contribChart, themeTypeUnchanged)
  }
}

Theme.DEFAULT_THRESHOLDS = null
Theme.CHROMA_TYPE = 'chroma'
Theme.POSTER_TYPE = 'poster'

class _ChromaTheme extends Theme {
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
    if (!_ChromaTheme.PATTERN_TYPE_DEFINED) {
      _ChromaTheme.PATTERN_TYPE_COL = 'color'
      _ChromaTheme.PATTERN_TYPE_ICO = 'icon'
      _ChromaTheme.PATTERN_TYPE_DAT = 'dataURL'
      _ChromaTheme.PATTERN_TYPE_DEFINED = true
    }

    if (pattern.startsWith('#')) {
      return _ChromaTheme.PATTERN_TYPE_COL
    } else if (pattern.startsWith('icons/')) {
      return _ChromaTheme.PATTERN_TYPE_ICO
    } else if (pattern.startsWith('data:image/')) {
      return _ChromaTheme.PATTERN_TYPE_DAT
    }
  }

  static setHTMLLegends(/* this, */ contribChart) {
    let legends = contribChart.querySelectorAll('.contrib-legend ul.legend > li')

    // Check for the number of legends
    if (legends.length != this.patterns.length) {
      console.error('There are ' + legends.length + ' legends but ' + this.patterns.length + ' theme')
      return
    }

    for (let ind = 0; ind < legends.length; ++ind) {
      let [pat, leg] = [ this.patterns[ind], legends[ind] ]
      let css = null

      switch (_ChromaTheme.getPatternType(pat)) {
        case _ChromaTheme.PATTERN_TYPE_COL:
          css = {
            'background-color': pat,
            'background-image': ''
          }
          break
        case _ChromaTheme.PATTERN_TYPE_ICO:
          css = {
            'background-color': '',
            'background-image': `url(${chrome.extension.getURL(pat)})`,
          }
          break
        case _ChromaTheme.PATTERN_TYPE_DAT:
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

  static setHTMLDayBlocks(contribChart) {
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
      switch (_ChromaTheme.getPatternType(pattern)) {
        case _ChromaTheme.PATTERN_TYPE_COL:
          rectElem.setAttribute('fill', pattern)
          if (imgElem) rectElem.parentNode.removeChild(imgElem)  // remove useless image block
          break

        case _ChromaTheme.PATTERN_TYPE_ICO:
          _is_ico = true // no break
        case _ChromaTheme.PATTERN_TYPE_DAT:
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

class _PosterTheme extends Theme {
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
    if (!_PosterTheme.POSTER_TYPE_DEFINED) {
      _PosterTheme.POSTER_TYPE_IMG = 'image'
      _PosterTheme.POSTER_TYPE_URL = 'url' // may be web url or dataURL
      _PosterTheme.POSTER_TYPE_DEFINED = true
    }

    if (poster.startsWith('posters/')) {
      return _PosterTheme.POSTER_TYPE_IMG
    } else if (poster.startsWith('url:')) { // this special header should be given by the code from the gallery part
      return _PosterTheme.POSTER_TYPE_URL
    }
  }

  static getPosterUrl(/* this, */) {
    switch (_PosterTheme.getPosterType(this.poster)) {
      case _PosterTheme.POSTER_TYPE_IMG: return chrome.extension.getURL(this.poster)
      case _PosterTheme.POSTER_TYPE_URL: return this._retrieved_poster_url
        // will be null if `waitForStorageCallback` haven't been called
      default: console.error("Can not parse poster: " + this.poster)
    }
  }

  static waitForStorageCallback(/* this, */ cb) {
    if (_PosterTheme.getPosterType(this.poster) != _PosterTheme.POSTER_TYPE_URL || this._retrieved_poster_url) {
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


  /* This is (not really) static because it is delegated by `Theme` class */
  static setHTMLLegends(/* this, */ contribChart) {
    let cb = _PosterTheme.setHTMLLegends.bind(this, contribChart) // call itself again
    if (_PosterTheme.waitForStorageCallback.call(this, cb)) return
      // wait for storage retrieval, which happens when `this.poster` is an identifier pointing to the storage
      // this function will be called again when that is ready

    let legends = contribChart.querySelectorAll('.contrib-legend ul.legend > li')

    for (let ind = 0; ind < legends.length; ++ind) {
      let [leg, alpha] = [ legends[ind], _PosterTheme.poster_mask_alphas[ind] ]
      let x = ind * 15

      let css = {
        'opacity': `${alpha}`,
        'background-image': `url(${_PosterTheme.getPosterUrl.call(this)})`,
        'background-position': `${x}% center`,
        'background-size': `auto 200%`  // twice the height of the legend
      }
      for (let key in css) {
        leg.style[key] = css[key]
      }
    }
  }

  /* This is (not really) static because it is delegated by `Theme` class */
  static setHTMLDayBlocks(/* this, */ contribChart) {
    let cb = _PosterTheme.setHTMLDayBlocks.bind(this, contribChart) // call itself again
    if (_PosterTheme.waitForStorageCallback.call(this, cb)) return
      // wait for storage retrieval, which happens when `this.poster` is an identifier pointing to the storage
      // this function will be called again when that is ready

    let svg = contribChart.querySelector('svg.js-calendar-graph-svg')

    // insert our poster
    // in svg, must use namespace-awared createElementNS instead of createElement
    let [svgW, svgH] = [svg.getAttribute('width'), svg.getAttribute('height')]
    let blockGroup = svg.querySelector('g') // first <g> element, will be set to transparent, but keep this elem to keep mouse events
    let [transW, transH] = blockGroup.getAttribute('transform').split(/[(,)\s]/).filter(x => x.match(/[0-9]+/)) // "translate(16, 20)" => [16, 20]

    let posterGroup = document.createElementNS("http://www.w3.org/2000/svg", "g")
    posterGroup.id = _PosterTheme.posterId
    posterGroup.innerHTML = `
      <mask id="${_PosterTheme.maskId}"></mask>
      <image
        href="${_PosterTheme.getPosterUrl.call(this)}"
        transform="translate(${transW}, ${transH})"
        width="${svgW-transW}" height="${svgH-transH}"
        mask="url(#${_PosterTheme.maskId})" preserveAspectRatio="xMidYMid slice"
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
      rectElem.setAttribute('fill', _PosterTheme.poster_mask_colors[ind])
    }

  }

  static clean(contribChart, themeTypeUnchanged) {
    let posterGroup = contribChart.querySelector(`#${_PosterTheme.posterId}`)
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
    } else if (!_PosterTheme.poster_web_valid_types.some(str => url.endsWith(str))) {
      return `url should end with one of "${_PosterTheme.poster_web_valid_types.join('", "')}"`
    }
  }
}

_PosterTheme.posterId = "_CGC-poster", // use leading underscore to denote privateness
_PosterTheme.maskId = "_CGC-poster-mask"
_PosterTheme.poster_mask_colors = ['#333', '#666', '#999', '#ccc','#fff'] // white -> visible for html blocks
_PosterTheme.poster_mask_alphas = [ 0.2, 0.4, 0.6, 0.8, 1.0 ] // transparency for legends
_PosterTheme.poster_web_valid_types = ['png', 'jpg', 'jpeg', 'webp', 'bmp']
_PosterTheme.poster_web_url_reg = new RegExp('https?:\/\/.*\.(?:' + _PosterTheme.poster_web_valid_types.join('|') + ')', 'i')
// _PosterTheme.poster_web_url_reg = /https?:\/\/.*\.(?:png|jpg|jpeg|webp|bmp)/i
