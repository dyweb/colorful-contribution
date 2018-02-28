/*
* @Author: gigaflw
* @Date:   2018-01-22 21:46:54
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-02-28 22:59:55
*/

window.CGC = {  // ok to add a variable to `window` since this `window` is private to this extension

  version: chrome.runtime.getManifest().version,

  // the threshold used by github default contribution coloring
  // non-customizeable for now
  default_thresholds: [10, 8, 5, 3, 0],

  // built-in themes
  default_themes: [{
    name: 'Primal',
    colors: ['#196127', '#239a3b', '#7bc96f', '#c6e48b', '#eee']    // the color used by GitHub
  }, {
    name: 'Cherry',
    colors: ['#c2185b', '#e91e63', '#f06292', '#f8bbd0', '#eee']
  }, {
    name: 'Tide',
    colors: ['#3949ab', '#5c6bc0', '#9fa8da', '#c5cae9', '#eee']
  }, {
    name: 'Solemn',
    colors: ['#111', '#555', '#888', '#bbb', '#eee']
  }, {
    name: 'Olympic',
    colors: ['#0000ff', '#fff000', '#000000', '#096600', '#ff0000']
  }, {
    name: 'Oreo',
    colors: ['#222', '#fff', '#222', '#fff', '#222']
  }, {
    name: 'Flower',
    colors: ['#196127', '#239a3b', '#7bc96f', '#c6e48b', 'icons/flower.ico']
  }],

  // the default theme when creating new ones
  default_theme: {
    name: 'Newbie',
    colors: ['#aae', '#acc', '#aea', '#cca', '#eaa']
  },

  colorType(colorStr) {
    return colorStr && colorStr[0] == '#' ? 'color' : 'icon'
  },

  //////////////////////////////
  // Themes Management Interface
  //////////////////////////////
  all_themes: null, // globally accessible variable, initialized from storage instantly after bootup

  /*
   * Send a theme object to `chrome.storage.local` and carry out content script `colorful.js`
   * the page will refresh iff this function is executed
   *
   * @params: theme: { Object | null }
   *   optional. If not given, the currently selected theme
   *     will be sent according to `chrome.storage.sync`
   */
  sendTheme(theme) {
    if (theme === null) {
      chrome.storage.sync.get('CGC_selected', obj => {
        let name = obj['CGC_selected']
        let theme = CGC.all_themes.find(t => t.name === name)
        CGC.sendTheme(theme)
      })
    } else {

      console.assert(theme.name)
      console.assert(theme.colors)

      if (!theme.thresholds) {
        theme.thresholds = CGC.default_thresholds
      }

      chrome.storage.local.set({
        'CGC': theme
      }, () => {
        chrome.tabs.executeScript({
          file: 'colorful.js'
        })
      })
    }
  },

  /*
   * Init `chrome.storage.sync` where permanent user settings are saved
   */
  initStorage() {
    chrome.storage.sync.set({
      'version': CGC.version,
      'CGC_all': CGC.default_themes,
      'CGC_selected': ''
    })
  },

  saveThemes() {
    chrome.storage.sync.set({'CGC_all': CGC.all_themes})
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
      theme = CGC.all_themes.find(t => t.name === theme)
    }
    if (!theme) return

    CGC.sendTheme(theme)
    chrome.storage.sync.set({ 'CGC_selected': theme.name })
  },

  /*
   * Delete the theme
   * `chrome.storage.sync['CGC_all']` will be changed
   * `chrome.storage.sync['CGC_selected']` will be set to empty string
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
    CGC.saveThemes()

    chrome.storage.sync.get('CGC_selected', obj => {
      if (obj['CGC_selected'] === theme.name ) {
        chrome.storage.sync.set({'CGC_selected': ''})
      }
    })

    chrome.storage.local.get('CGC', obj => {
      if (obj['CGC'].name === theme.name ) {
        chrome.storage.local.set({'CGC': ''})
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
