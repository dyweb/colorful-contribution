/*
* @Author: gigaflw
* @Date:   2018-11-06 10:38:32
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-11-06 23:04:01
*/

/*
 * Palette is the color pickler located in the icon gallery
 */
class Palette {
  constructor(paletteElem) {
    this.palette = paletteElem

    this.hexagons = Array.from(this.palette.querySelectorAll('.hexagon'))
    this.sliders = Array.from(this.palette.querySelectorAll('.slider'))
    this.chainBtn = this.palette.querySelector('.js-chain-btn')
    this.flipBtn = this.palette.querySelector('.js-flip-btn')

    if (this.hexagons.length !== 5) throw new RangeError("Expected 5 hexagons in palette!")
    if (this.sliders.length !== 3) throw new RangeError("Expected 3 sliders in palette!") // corresponding to h,s,l

    this._initSliders()
  }

  bindEvents() {
    this.hexagons.forEach(this._bindHexagon.bind(this))
    this.sliders.forEach(this._bindSlider.bind(this))
    this._bindBtns()
  }

  clear() {
    this.clearSelectedHexagon()
    this.clearChained()
  }

  reset() {
    let manager = getEditingThemeManager()
    if (!manager) return

    // init hexagons
    let colors = manager.getPatternBlockColors()

    let firstInd = -1, lastInd = -1

    for (let i = 0; i < this.hexagons.length; ++i) {
      let hex = this.hexagons[i],
          color = colors[i]
      if (!color) { // the pattern is an icon instead of a color
        hex.classList.add('is-non-color')
        hex.style['background-color'] = ''
      } else {
        hex.classList.remove('is-non-color')
          // first color (except the index 0,
          // which is very probably to be white/grey
          // and should be excluded from auto-gradient)
        if (firstInd < 0 && i > 0) { firstInd = i }
        if (i > lastInd) { lastInd = i }
        hex.style.cssText = `background-color: ${color}`
      }
    }

    this.setSelctedHexagonInd(lastInd)
    this.setChainedRange(firstInd, lastInd)

    // init sliders
    let color = this.getSelectedHexagon().style['background-color']
    this.setSliderHSL(rgbStr2hsl(color))
  }

  /*
   * Set the hsl dataset and appearance in sliders
   *
   * To set only one channel:
   *   setSliderHSL(<channel>, <val>)
   *   @params { Integer } channel 
   *     0 -> H, 1 -> S, 2 -> L
   *   @params { Float } val
   *     A float between 0 and 1
   *
   * To set all three channels:
   *   setSliderHSL([<h>, <s>, <l>])
   *   @params { Array[Float] } [h, s, l] 
   *     All between 0 and 1
   */
  setSliderHSL(channel, val) {
    let h, s, l

    if (val === undefined) {
      [h, s, l] = channel
      this.sliders.forEach((slider, ind) => { slider.dataset['val'] = [h, s, l][ind].toFixed(4) })
    } else {
      this.sliders[channel].dataset['val'] = val.toFixed(4);
      [h, s, l] = this.getSliderHSL()
    }

    // modify the color css
    this.sliders.forEach((sld, i) => {
      let wnd = sld.querySelector('.window'),
          gradStr = [
            range(0, 361, 30).map(x => `hsl(${x}, ${s * 100}%, ${l * 100}%)`),
            range(0, 101, 10).map(x => `hsl(${h * 360}, ${x}%, ${l * 100}%)`),
            range(0, 101, 10).map(x => `hsl(${h * 360}, ${s * 100}%, ${x}%)`),
          ][i].join(', ')

      sld.style.cssText = `background-image: linear-gradient(90deg, ${gradStr});`
      wnd.style.left = (sld.offsetWidth * [h, s, l][i] - wnd.offsetWidth / 2) + 'px'
    })
  }

  getSliderHSL() {
    return this.sliders.map(s => parseFloat(s.dataset['val']))
  }

  /*
   * One of the hexagons is selected, whose color is displayed and editable in sliders
   */
  getSelectedHexagon() {
    return this.hexagons[this.getSelectedHexagonInd()]
  }

  getSelectedHexagonInd() {
    return parseInt(this.palette.dataset['selected'])
  }

  setSelctedHexagonInd(ind) {
    this.palette.dataset['selected'] = ind

    // only one hexagon can be selected (the selected hexagon's color is adjustable by the color picker)
    this.hexagons.forEach((hex, i) => hex.classList[(i == ind) ? 'add' : 'remove']('selected'))
  }

  clearSelectedHexagon() {
    delete this.palette.dataset['selected']
    this.hexagons.forEach(hex => hex.classList.remove('selected'))
  }

  isChained() {
    return this.chainBtn.classList.contains('activated')
  }

  getChainedRange() {
    return ['rangeBeg', 'rangeEnd'].map(x => parseInt(this.palette.dataset[x]))
  }

  setChainedRange(beg, end) {
    this.palette.dataset['rangeBeg'] = beg
    this.palette.dataset['rangeEnd'] = end

    let chained = this.isChained()
    // only two hexagons can be large (the large hexagons denote the range of auto gradient)
    for (let i = 0; i < this.hexagons.length; ++i) {
      let cls = this.hexagons[i].classList
      cls[(i !== beg && i !== end) ? 'add' : 'remove']('is-not-chain-endpoint')
      if (chained) cls[(beg <= i && i <= end) ? 'add' : 'remove']('is-chained')
    }
  }

  setChained() {
    let [beg, end] = this.getChainedRange()
    let _op = this.isChained() ? i => ((beg <= i && i <= end) ? 'add' : 'remove') : i => 'remove'
    for (let i = 0; i < this.hexagons.length; ++i) {
      this.hexagons[i].classList[_op(i)]('is-chained')
    }
  }

  clearChained() {
    delete this.palette.dataset['rangeBeg']
    delete this.palette.dataset['rangeEnd']
    for (let i = 0; i < this.hexagons.length; ++i) {
      this.hexagons[i].classList.remove('is-chained')
      this.hexagons[i].classList.remove('is-not-chain-endpoint')
    }
    this.chainBtn.classList.remove('activated')
  }

  getHexagonHSL(ind) {
    return rgbStr2hsl(this.hexagons[ind].style['background-color'])
  }

  setHexagonColor(ind, colorCSS) {
    this.hexagons[ind].style.cssText = `background-color: ${colorCSS}`
  }

  /***********
   * Events
   ***********/
  _initSliders() {
    // init & bind event for sliders
    this.sliders.forEach((slider, ind) => {
      slider.querySelector('.window').style.cssText = 'left: 0;'
    })
  }

  _bindSlider(slider, ind) {
    slider.addEventListener("click", event => {
      let percent = (event.clientX - slider.offsetLeft) / slider.clientWidth

      // update slider dataset and appearance
      this.setSliderHSL(ind, percent)

      // calculate the new colors for hexagons and pattern blocks
      let manager = getEditingThemeManager(),
          selectedIdx = this.getSelectedHexagonInd(),
          curColor = this.getSliderHSL(),
          newColors = []
      newColors[selectedIdx] = curColor

      // if chained, auto-calc the gradients for hexagons/pattern blocks in the chained range
      if (this.isChained()) {
        let [beg, end] = this.getChainedRange()

        if (selectedIdx !== beg && selectedIdx !== end) {
          throw new Error("selected index " + selectedIdx + " is not one of the range ends: " + [beg, end])
        }

        // determine two end points
        if (selectedIdx !== beg) newColors[beg] = this.getHexagonHSL(beg)
        if (selectedIdx !== end) newColors[end] = this.getHexagonHSL(end)
        newColors[selectedIdx] = curColor

        // calculate auto gradients
        let step = zip((x, y) => (y - x) / (end - beg), newColors[beg], newColors[end])
        for (let i = beg + 1; i < end; ++i) {
          newColors[i] = zip((x, y) => x + y, newColors[i-1], step)
        }
      }

      // update colors
      newColors = newColors.map((color, ind) => {
        if (color) {
          let [h, s, l] = color,
              css = `hsl(${h * 360}, ${s * 100}%, ${l * 100}%)`
          this.setHexagonColor(ind, css)
          return css
        } else {
          return null
        }
      })
      
      manager.setColors(newColors)

    })
  }

  _bindHexagon(hexagon, ind) {
    hexagon.addEventListener('click', event => {
      if (hexagon.classList.contains('is-non-color')) return

      this.setSelctedHexagonInd(ind)

      // only two hexagons can be large (the large hexagons denote the range of auto gradient)
      let beg, end, [beg_, end_] = this.getChainedRange()

      if (ind !== beg_ && ind !== end_) {// range changed
        if (Math.abs(ind - beg_) <= Math.abs(ind - end_)) {
          [beg, end] = [ind, end_]
        } else {
          [beg, end] = [beg_, ind]
        }

        this.setChainedRange(beg, end)
        if (this.isChained()) this.setChained()
      }

      let rgbStr = this.getSelectedHexagon().style['background-color']
      this.setSliderHSL(rgbStr2hsl(rgbStr))
    })
  }

  _bindBtns() {
    this.chainBtn.addEventListener('click', event => {
      this.chainBtn.classList.toggle('activated')
      this.setChained()
    })

    // flipBtn is bound outside, because that involves non-local html elements
  }
}