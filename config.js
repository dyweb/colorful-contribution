/*
* @Author: gigaflw
* @Date:   2018-01-22 21:46:54
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-01-23 22:06:24
*/

window.CGC = {  // ok to add a variable to `window` since this `window` is private to this extension

  version: chrome.runtime.getManifest().version,

  // the threshold used by github default contribution coloring
  // non-customizeable for now
  default_thresholds: [10, 8, 5, 3, 0],

  // built-in themes
  default_themes: [{
    name: 'grey',
    colors: ['#111', '#555', '#888', '#bbb', '#eee']
  }, {
    name: 'cherry',
    colors: ['#311', '#755', '#a88', '#dbb', '#fee']
  }],

  ////////////////////////////
  // Themes Storage Interface
  ////////////////////////////
  sendTheme(theme) {
    if (!theme) return

    if (!theme.thresholds) {
      theme.thresholds = CGC.default_thresholds
    }

    chrome.storage.local.set({
      'colorful-github': theme
    }, () => {
      chrome.tabs.executeScript({
        file: 'colorful.js'
      })
    })
  },

  /*
   * Init `chrome.storage.sync` where permanent user settings are saved
   */
  initStorage() {
    chrome.storage.sync.set({
      'version': CGC.version,
      'colorful-github-all': CGC.default_themes,
      'colorful-github-selected': ''
    })
  },

  saveThemes(themes) {
    chrome.storage.sync.set({'colorful-github-all': themes})
    // TODO: Save all themes altogether may have efficiency issue
  },

  setTheme(theme) {
    CGC.sendTheme(theme)
    chrome.storage.sync.set({ 'colorful-github-selected': theme.name })
  }
  /////////////////////////////////
  // Themes Storage Interface Ends
  /////////////////////////////////
}
