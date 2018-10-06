/*
* @Author: gigaflw
* @Date:   2018-09-05 08:11:35
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-10-06 22:43:55
*/

class Theme {
  constructor(name, type) {
    this.name = name
    this.setThemeType(type)
    this.thresholds = Theme.DEFAULT_THRESHOLDS
  }

  setThemeType(type) {
    type = type.toLowerCase()
    console.assert([Theme.CHROMA_TYPE, Theme.POSTER_TYPE].includes(type))
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

  static setHTMLLegends(contribChart) {
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
  static setHTMLLegends(contribChart) {
    let legends = contribChart.querySelectorAll('.contrib-legend ul.legend > li')

    for (let ind = 0; ind < legends.length; ++ind) {
      let [leg, alpha] = [ legends[ind], _PosterTheme.poster_mask_alphas[ind] ]
      let x = ind * 10

      let css = {
        'opacity': `${alpha}`,
        'background-image': `url(${chrome.extension.getURL(this.poster)})`,
        'background-position': `${x}% center`,
        'background-size': `auto 200%`
      }
      for (let key in css) {
        leg.style[key] = css[key]
      }
    }
  }

  static setHTMLDayBlocks(contribChart) {
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
        href="${chrome.extension.getURL(this.poster)}"
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
}

_PosterTheme.posterId = "_CGC-poster", // use leading underscore to denote privateness
_PosterTheme.maskId = "_CGC-poster-mask"
_PosterTheme.poster_mask_colors = ['#333', '#666', '#999', '#ccc','#fff'] // white -> visible for html blocks
_PosterTheme.poster_mask_alphas = [ 0.2, 0.4, 0.6, 0.8, 1.0 ] // transparency for legends
