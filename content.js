/*
 * @Author: gigaflower
 * @Date:   2017-11-19 13:55:57
 * @Last Modified by:   gigaflw
 * @Last Modified time: 2018-09-06 14:07:46
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
 *       patterns:    string[]  N valid color strings in css
 *     } or
 *     {
 *       name:        string
 *       thresholds:  int[]
 *       poster:      string    the path to the poster file
 *     }
 *     where `N` is the number of patterns, equals to the number of legends
 *     the length of this object is required to equal to the length of `.contrib-legend ul.legend > li`
 *   (3) For each `.calendar-graph .day`, reset its color acoording to the object
 */

console.assert(typeof Theme !== 'undefined', "`Theme` not found, please inject `theme.js` together with content script")

chrome.storage.local.get('CGC', (theme) => {
  theme = theme['CGC']
  if (!theme) return
  theme = Theme.fromObject(theme)

  let contribChart = document.querySelector('.js-yearly-contributions')

  theme.setHTMLLegends(contribChart)

  theme.setHTMLDayBlocks(contribChart)
})
