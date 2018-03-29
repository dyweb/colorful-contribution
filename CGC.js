/*
* @Author: gigaflw
* @Date:   2018-01-22 21:46:54
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-03-29 10:00:38
*/

// CGC means colorful github contributino
// window.CGC is the collection of global states/methods
// 
// Calling relationship:
// popup.js -- Themes Management Interface -----> CGC.js  -- `sendTheme()` -->  content.js
// gallery.js  -- Icon Management Interface -/

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
    colors: ['icons/flower.png', '#239a3b', '#7bc96f', '#c6e48b', '#eee']
  }, {
    name: 'Mario',
    colors: ['icons/mario-1up.png', 'icons/mario-fireflower.png', 'icons/mario-star.png', 'icons/mario-coin.png', '#eee']
  }],

  // the default theme when creating new ones
  default_theme: {
    name: 'Newbie',
    colors: ['#aae', '#acc', '#aea', '#cca', '#eaa']
  },

  //////////////////////////////
  // Themes Management Interface
  //////////////////////////////
  all_themes: null, // globally accessible variable, initialized from storage instantly after bootup

  /*
   * Send a theme object to `chrome.storage.local` and carry out content script `content.js`
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
          file: 'content.js'
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

  clearStorage() {
    chrome.storage.sync.clear()
    chrome.storage.local.clear()
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
  },

  getTheme(themeName) {
    return CGC.all_themes.find(th => th.name === themeName)
  },

  ///////////////////////////////////
  // Themes Management Interface Ends
  ///////////////////////////////////

  ///////////////////////////////////
  // Icon Management Interface
  ///////////////////////////////////
  /*
   * Traverse the extension folder
   *
   * @params path { String }
   * @params filter { Function }
   *         @param { FileEntry } file, `FileEntry`: https://developer.mozilla.org/en-US/docs/Web/API/FileSystemEntry
   *         @return { Boolean } filter this file out if `true`
   *         e.g. file => file.name.endsWith('png')
   * @params cb: { Function }
   *         @param { File } file - each file will be called with callback, `File`: https://developer.mozilla.org/en-US/docs/Web/API/File
   *         @param { Boolean } is_last - whether current file is the last
   */
  traverseDir(path, filter, cb){
    chrome.runtime.getPackageDirectoryEntry(fs => {
      fs.getDirectory(path, {create: false}, dir => {
        dir.createReader().readEntries(files => {

          files = files.filter(filter)

          for (let ind in files) {
            let is_last_file = ind == files.length - 1
            files[ind].file(f => cb(f, is_last_file))
          }
        })
      })
    })
  },

  /*
   * Read a file as dataurl, intended for images
   * @params file { File }
   * @params cb { Function }
   *         @param: event, where `event.target.result` is the dataurl
   */
  readFileAsDataURL(file, cb) {
    let reader = new FileReader()
    reader.addEventListener('load', cb)
    reader.readAsDataURL(file)
  },

  /*
   * Load all icons, include predefined ones and user-defined ones
   *
   * @params predCb { Function }  -  callback for predefined icons
   *         @params dataURL { String } the dataURL of the image,
   *         @params fileName { String } the name of the file, used as identifier
   * @params userCb { Function }  -  callback for user-defined icons
   *         @params dataURL { String } the dataURL of the image,
   *         @params date { Int } the timestamp of the icon, used as identifier
   *
   * userCb will only be called after all predefined icons have been called with,
   *   so that they do not mix up
   */
  getIcons(predCb, userCb) {
    function load_predefined_icons(then) {
      CGC.traverseDir('icons',
          file => file.name.match(/png|jpg|jpeg|ico$/),
          (file, is_last_file) => {
            CGC.readFileAsDataURL(file, event => {
              predCb(event.target.result, file.name)
              if (is_last_file) then()
            })
          }
        )
    }

    // Display all user icon files
    function load_user_icons(){
      chrome.storage.sync.get({'CGC_user_icons': []}, obj => {
        for (let [date, dataURL] of obj['CGC_user_icons']) {
          userCb(dataURL, date)
        }
      })
    }

    // put all user icons after predefined ones, so that they do not mix up
    load_predefined_icons(load_user_icons)
  },

  addIcon(iconId, dataURL) {
    chrome.storage.sync.get({'CGC_user_icons': []}, obj => {
      obj['CGC_user_icons'].push([iconId, dataURL])
      chrome.storage.sync.set({'CGC_user_icons': obj['CGC_user_icons']})
    })
  },

  removeIcon(iconId, cb) {
    chrome.storage.sync.get({'CGC_user_icons': []}, obj => {
      let ind = obj['CGC_user_icons'].findIndex(icon => icon[0] == iconId)
      if (ind === -1) return
      obj['CGC_user_icons'].splice(ind, 1)
      chrome.storage.sync.set({'CGC_user_icons': obj['CGC_user_icons']})
      cb()
    })
  }
  ///////////////////////////////////
  // Icon Management Interface Ends
  ///////////////////////////////////
}
