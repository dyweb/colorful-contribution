/*
 * @Author: gigaflower
 * @Date:   2017-11-19 13:55:57
 * @Last Modified by:   gigaflw
 * @Last Modified time: 2018-05-08 09:12:17
 *
 * This file is intended as content script for github contribution page
 *
 * For the script to work, the html is assumed to
 *   (1) have blocks classed `.calendar-graph .day`, representing
 *       days to be colored according to one's contribution on that day.
 *       Each block should have a datafield `data-count` denoting the
 *       number of contributions one did that day.
 *   (2) have legends classed '.contrib-legend ul.legend > li', the color of
 *       which, denotes the coresponding color to a certain contribution count.
 *       For now, there are 5 levels, ( so there are 5 legends and 5 different color).
 * 
 * Once this is injected, it
 *   (1) Try to reterieve a key-value pair `{ CGC: < the_theme_to_be_shown > }` from `chrome.storage.local`
 *   (2) The format of the theme obj is expected like this
 *     {
 *       name:        string
 *       thresholds:  int[]     N integers in desecending order
 *       colors:      string[]  N valid color strings in css
 *     }
 *     where `N` is the number of colors, equals to the number of legends
 *     the length of this object is required to equal to the length of `.contrib-legend ul.legend > li`
 *   (3) For each `.calendar-graph .day`, reset its color acoording to the object
 */

chrome.storage.local.get('CGC', (theme) => {
  function colorType(colorStr) {
      let colorType = null
      if (colorStr.startsWith('#')) colorType = 'color'
      else if (colorStr.startsWith('icons/')) colorType = 'icon'
      else if (colorStr.startsWith('data:image/')) colorType = 'dataURL'

      return colorType
  }

  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError)
    return
  }

  theme = theme['CGC']
  if (!theme) return

  let legends = document.querySelectorAll('.contrib-legend ul.legend > li')
  
  // check for profile page
  if (legends.length === 0) {
    return
  }

  // Check for the number of legends
  if (legends.length != theme.colors.length) {
    console.error('There are ' + legends.length + ' legends but ' + theme.colors.length + ' theme')
    return
  }

  // Update legend color
  for (let ind = 0; ind < legends.length; ++ind) {
    let color = theme.colors[theme.colors.length - ind - 1],
      colorT = colorType(color)

    if (colorT === 'color') {
      legends[ind].style['background-color'] = color
      legends[ind].style['background-image'] = ''
    } else if (colorT === 'icon') {
      legends[ind].style['background-color'] = ''
      legends[ind].style['background-image'] = `url(${chrome.extension.getURL(color)})`
    } else if (colorT === 'dataURL') {
      legends[ind].style['background-color'] = ''
      legends[ind].style['background-image'] = `url(${color})`
    } 
  }

  // Update contribution block color
  function getColor(cnt){
    let ind = theme.thresholds.findIndex(v => v <= cnt) // find the first color with a threshold lower than the target
    return theme.colors[ind]
  }


  let days = document.querySelectorAll('.calendar-graph rect.day')
  for (let d of days) {
    // each day block now can be one of the
    // 1. <rect class="day"></rect>, same as the github default, except for possible color alteration
    // 2. <image></image><rect class="day"></rect>, 2 elements
    //  the upper layer `rect` is used to triggle events and should be set to transparent

    let cnt = d.dataset.count,
      color = cnt && getColor(cnt),
      colorT = colorType(color)
    if (colorT === 'color') {
      d.setAttribute('fill', color)
      let prev = d.previousElementSibling
      if (prev && prev.matches('image')) d.parentNode.removeChild(prev)  // remove useless image block
    } else if (colorT == 'icon' || colorT == 'dataURL') {
      d.setAttribute('fill', 'transparent')
      let prev = d.previousElementSibling
      let href = colorT === 'icon' ? chrome.extension.getURL(color) : color

      if (prev && prev.matches('image')) {
        prev.setAttribute('href', href)
      } else {
        let img = d.cloneNode()
        img.setAttribute('href', href)
        d.parentNode.insertBefore(img, d)
        img.outerHTML = img.outerHTML.replace('rect', 'image')
      }
    }
  }
})
