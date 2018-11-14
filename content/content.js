/*
 * @Author: gigaflower
 * @Date:   2017-11-19 13:55:57
 * @Last Modified by:   gigaflw
 * @Last Modified time: 2018-11-14 10:29:18
 *
 * TODO: this doc is used in version 0.2.1 and is now deprecated
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

if (document.querySelector('.js-yearly-contributions')) {

  chrome.storage.local.get('CGC', (theme) => {
    theme = theme['CGC']
    if (!theme) return
    theme = Theme.fromObject(theme)

    // detect contrib thresholds if necessary
    if (theme.thresholds == '<to_be_detected>') {
      theme.thresholds = Theme.detectContribLevelThresholds()
    }

    let contrib = document.querySelector('.js-yearly-contributions')

    // clean old theme
    window._CGC_themeToBeCleaned && Theme.clean(contrib, window._CGC_themeToBeCleaned, window._CGC_themeToBeCleaned === theme.type)

    theme.setHTMLLegends(contrib)

    theme.setHTMLDayBlocks(contrib)

    window._CGC_themeToBeCleaned = theme.type
  })

}
