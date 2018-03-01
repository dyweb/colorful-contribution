/*
 * @Author: gigaflower
 * @Date:   2017-11-19 13:55:57
 * @Last Modified by:   gigaflw
 * @Last Modified time: 2018-03-01 09:17:40
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
 *       colors:      string[]  N valide color strings in css
 *     }
 *     where `N` is the number of colors, equals to the number of legends
 *     the length of this object is required to equal to the length of `.contrib-legend ul.legend > li`
 *   (3) For each `.calendar-graph .day`, reset its color acoording to the object
 */

chrome.storage.local.get('CGC', (theme) => {
  function colorType(colorStr) {
    // Same as `colorType` from config.js
    // Fixme: a tight couple here
    return colorStr && colorStr[0] == '#' ? 'color' : 'icon'
  }

  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError)
    return
  }

  theme = theme['CGC']
  if (!theme) return

  let legends = document.querySelectorAll('.contrib-legend ul.legend > li'),
    days = document.querySelectorAll('.calendar-graph .day')

  // Check for the number of legends
  if (legends.length != theme.colors.length) {
    console.error('There are ' + legends.length + ' legends but ' + theme.length + ' theme')
    return
  }

  // Update legend color
  for (let ind = 0; ind < legends.length; ++ind) {
    let color = theme.colors[theme.colors.length - ind - 1]

    if (colorType(color) === 'color') {
      legends[ind].style['background-color'] = color
      legends[ind].style['background-image'] = ''
    } else {
      // always regard as a image otherwise
      legends[ind].style['background-color'] = ''
      legends[ind].style['background-image'] = `url(${chrome.extension.getURL(color)})`
    }
  }

  // Update contribution block color
  function getColor(cnt){
    let ind = theme.thresholds.findIndex(v => v <= cnt)
    return theme.colors[ind]
  }

  for (let d of days) {
    let cnt = d.dataset.count,
      color = cnt && getColor(cnt),
      colorT = colorType(color)
    if (colorT === 'color') {
      d.setAttribute('fill', color)
      if (d.tagName === 'image')  d.outerHTML = d.outerHTML.replace('image', 'rect')  // have to be last line because this will invalidate `d`
    } else if (colorT == 'icon') {
      d.setAttribute('href', chrome.extension.getURL(color))
      if (d.tagName === 'rect')  d.outerHTML = d.outerHTML.replace('rect', 'image')  // have to be last line because this will invalidate `d`
    }
  }
})
