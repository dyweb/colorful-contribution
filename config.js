/*
* @Author: gigaflw
* @Date:   2018-01-22 21:46:54
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-01-22 22:11:30
*/

window.CGC_CONFIG = {  // ok to add a variable to `window` since this `window` is private to this extension
  version: chrome.runtime.getManifest().version,
  default_thresholds: [10, 8, 5, 3, 0],  // the threshold used by github defeault contribution coloring
  default_themes: [{
    name: 'grey',
    colors: ['#111', '#555', '#888', '#bbb', '#eee']
  }, {
    name: 'cherry',
    colors: ['#311', '#755', '#a88', '#dbb', '#fee']
  }]
}
