/*
* @Author: gigaflw
* @Date:   2018-09-05 08:11:35
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-09-06 14:05:12
*/

class Theme {
  constructor(name, thresholds=null) {
    this.name = name
    this.thresholds = thresholds || Theme.DEFAULT_THRESHOLDS
  }

  /*
   * Modify the legend elements accoding to the theme
   *
   * @param: contribChart: the whole contributiion chart element
   *   For now, it can be get by document.querySelector('.js-yearly-contributions')
   */
  setHTMLLegends(contribChart) { console.error("Virtual function called") }

  /*
   * Modify the day blocks accoding to the theme
   *
   * @param: contribChart: the whole contributiion chart element
   *   For now, it can be get by document.querySelector('.js-yearly-contributions')
   */
  setHTMLDayBlocks(contribChart) { console.error("Virtual function called") }

  copy() {
    if (intanceof(this, ChromaTheme)) {
      return new ChromaTheme(this.name, this.patterns.slice())
    } else if (intanceof(this, PosterTheme)) {
      return new PosterTheme(this.name, this.poster)
    }
  }

  static fromObject(obj) {
    console.assert(obj.name, "Parsed failed. A theme obj is required to have `name` field. Given: ", obj)
    console.assert(obj.thresholds && obj.thresholds.length > 0, "Parsed failed. A theme obj is required to have `thresholds` field. Given: ", obj)
    console.assert(obj.poster || (obj.patterns && obj.patterns.length > 0), "Parsed failed. A theme obj is required to have `patterns` or `poster` field. Given: ", obj)

    if (obj.poster) {
      return new PosterTheme(obj.name, obj.poster, obj.thresholds)
    } else {
      return new ChromaTheme(obj.name, obj.patterns, obj.thresholds)
    }
  }
}

Theme.DEFAULT_THRESHOLDS = null

class ChromaTheme extends Theme {
  constructor(name, patterns, thresholds=null) {
    super(name, thresholds)
    this.patterns = patterns

    function all(cb, ...arrs) {
      for (let i = 0; i < arrs.length; ++i) {
        let args = []
        for (let arr of arrs) { args.push(arr[i]) }
        if (!cb(...args)) return false
      }
      return true
    }
    function increasing(arr) { return all((x, y) => x <= y, arr.slice(0, -1), arr.slice(1)) }
    console.assert(increasing(this.thresholds), "thresholds should be increasing!")
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
  getPatternType(pattern) {
    if (!ChromaTheme.PATTERN_TYPE_DEFINED) {
      ChromaTheme.PATTERN_TYPE_COL = 'color' 
      ChromaTheme.PATTERN_TYPE_ICO = 'icon'
      ChromaTheme.PATTERN_TYPE_DAT = 'dataURL' 
      ChromaTheme.PATTERN_TYPE_DEFINED = true
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
      console.error('There are ' + legends.length + ' legends but ' + theme.patterns.length + ' theme')
      return
    }

    for (let ind = 0; ind < legends.length; ++ind) {
      let [pat, leg] = [ this.patterns[ind], legends[ind] ]
      let css = null

      switch (this.getPatternType(pat)) {
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
      let _cnt = rectElem.dataset.count
      let _pat_ind = _cnt && this.thresholds.findIndex(th => th >= _cnt) // TODO: the real mapping is more complicated
      if (_pat_ind < 0) _pat_ind = this.patterns.length - 1 
      let pattern = this.patterns[_pat_ind]

      let _prev = rectElem.previousElementSibling
      let imgElem = (_prev && _prev.matches('image')) ? _prev : null

      // each day block now can be one of the
      // 1. <rect class="day"></rect>, same as the github default, except for possible color alteration
      // 2. <image></image><rect class="day"></rect>, 2 elements
      //  the upper layer `rect` is used to triggle events and should be set to transparent
      let _is_ico = false
      switch (this.getPatternType(pattern)) {
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
            img.outerHTML = img.outerHTML.replace('rect', 'image')
          }
          break

        default:
          console.error("Can not parse pattern: ", pat)
      }
    }
  }
}

class PosterTheme extends Theme {
  constructor(name, poster, thresholds=null) {
    super(name, thresholds)
    this.poster = poster
  }
  setHTMLLegends(contribChart) { console.error("Virtual function called") }
  setHTMLDayBlocks(contribChart) { console.error("Virtual function called") }
}
