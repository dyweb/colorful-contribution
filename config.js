/*
* @Author: gigaflw
* @Date:   2018-01-22 21:46:54
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-01-25 16:30:36
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

  default_theme: {
    name: 'Newbie',
    colors: ['#aae', '#acc', '#aea', '#cca', '#eaa']
  },

  //////////////////////////////
  // Themes Management Interface
  //////////////////////////////
  all_themes: null, // globally accessible variable, initialized from storage instantly after bootup

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

  saveThemes() {
    chrome.storage.sync.set({'colorful-github-all': CGC.all_themes})
    // TODO: Save all themes altogether may have efficiency issue
  },

  /*
   * Set the theme currently in use
   * will send to `chrome.storage.local` to trigger actual page modification
   *
   * @params theme { String | Object }
   *    The theme object or its name.
   *    Will do nothing if a string is given but can not be found from `all_themes`
   */
  setTheme(theme) {
    if (typeof(theme) === 'string') {
      theme = CGC.all_themes.find(t => t.name == theme)
    }
    if (!theme) return

    CGC.sendTheme(theme)
    chrome.storage.sync.set({ 'colorful-github-selected': theme.name })
  },

  /*
   * Delete the theme
   * `chrome.storage.sync['colorful-github-all']` will be changed
   * `chrome.storage.sync['colorful-github-selected']` will be set to empty string
   *   if it happens to be deleted
   * 
   * @params theme { String | Object }
   *    The theme object or its name.
   *    Will do nothing if a string is given but can not be found from `all_themes`
   */
  deleteTheme(theme) {
    if (typeof(theme) === 'string') {
      theme = CGC.all_themes.find(t => t.name == theme)
    }
    if (!theme) return

    let ind = CGC.all_themes.indexOf(theme)
    if (ind == -1) return

    CGC.all_themes.splice(ind, 1)
    CGC.saveThemes(CGC.all_themes)

    chrome.storage.sync.get('colorful-github-selected', obj => {
      if (obj['colorful-github-selected'] === theme.name ) {
        chrome.storage.sync.set({'colorful-github-selected': ''})
      }
    })

    chrome.storage.local.get('colorful-github', obj => {
      if (obj['colorful-github'].name === theme.name ) {
        chrome.storage.local.set({'colorful-github': ''})
      }
    })
  },

  /*
   * Create a default theme and add it into `all_themes`
   * the new copy of default theme will be returned
   * this new theme will be save to `chrome.storage.sync`
   */
  addNewTheme() {
    if (CGC.all_themes === null) {
      console.error("Themes are not initialized! Failed to add a new one.")
      return
    }

    let theme = {
      name: CGC.default_theme.name,
      colors: CGC.default_theme.colors.slice(),
    }

    CGC.all_themes.push(theme)
    CGC.saveThemes()
    return theme
  }

  ///////////////////////////////////
  // Themes Management Interface Ends
  ///////////////////////////////////
}
