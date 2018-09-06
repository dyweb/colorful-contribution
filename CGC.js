/*
* @Author: gigaflw
* @Date:   2018-01-22 21:46:54
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-09-06 13:37:04
*/

// CGC means colorful github contributino
// window.CGC is the collection of global states/methods
// 
// Calling relationship:
// popup.js -- Themes Management Interface -----> CGC.js  -- `sendTheme()` -->  content.js
// gallery.js  -- Icon Management Interface -/

console.assert(typeof Theme !== 'undefined', "`Theme` not found, include `theme.js` before `CGC.js`")

Theme.DEFAULT_THRESHOLDS = [0, 3, 5, 8, 10] // 0 => patterns[0], 1,2,3 => patterns[1], etc.

window.CGC = {  // ok to add a variable to `window` since this `window` is private to this extension

  version: chrome.runtime.getManifest().version,

  // the threshold used by github default contribution coloring, ranged from 0 to 10
  // non-customizeable for now
  defaultThresholds: Theme.DEFAULT_THRESHOLDS,

  // built-in themes
  defaultThemes: [
    new ChromaTheme('Primal', ['#eee'   , '#c6e48b', '#7bc96f', '#239a3b', '#196127']),    // the color used by GitHub
    new ChromaTheme('Cherry', ['#eee'   , '#f8bbd0', '#f06292', '#e91e63', '#c2185b']),
    new ChromaTheme('Tide',   ['#eee'   , '#c5cae9', '#9fa8da', '#5c6bc0', '#3949ab']),
    new ChromaTheme('Solemn', ['#eee'   , '#bbb'   , '#888'   , '#555'   , '#111'   ]),
    new ChromaTheme('Olympic',['#ff0000', '#096600', '#000000', '#fff000', '#0000ff']),
    new ChromaTheme('Oreo',   ['#222'   , '#fff'   , '#222'   , '#fff'   , '#222'   ]),
    new ChromaTheme('Flower', ['#eee', '#c6e48b', '#7bc96f', '#239a3b', 'icons/flower.png']),
    new ChromaTheme('Mario',  ['#eee', 'icons/mario-coin.png', 'icons/mario-star.png', 'icons/mario-fireflower.png', 'icons/mario-1up.png']),
    new PosterTheme('Comet', 'posters/name.jpg',),
  ],

  // the default theme when creating new ones
  defaultTheme: new ChromaTheme('Newbie', ['#aae', '#acc', '#aea', '#cca', '#eaa']),

  //////////////////////////////
  // Themes Management Interface
  //////////////////////////////
  allThemes: null, // globally accessible variable, initialized from storage instantly after bootup

  /*
   * Send a theme object to `chrome.storage.local` and carry out content script `content.js`
   * the page will refresh iff this function is executed
   *
   * @params: theme: { object | null }
   *   optional. If not given, the currently selected theme
   *     will be sent according to `chrome.storage.sync`
   */
  sendTheme(theme) {
    if (theme === null) {
      chrome.storage.sync.get('CGC_selected', obj => {
        let name = obj['CGC_selected']
        let theme = CGC.allThemes.find(t => t.name === name)
        CGC.sendTheme(theme)
      })
    } else {

      if (!theme.thresholds) theme.thresholds = CGC.defaultThresholds

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
      'CGC_all': CGC.defaultThemes,
      'CGC_selected': ''
    })
  },

  clearStorage() {
    chrome.storage.sync.clear()
    chrome.storage.local.clear()
  },

  saveThemes() {
    chrome.storage.sync.set({'CGC_all': CGC.allThemes})
    // TODO: Save all themes altogether may have efficiency issue
  },

  /*
   * Set the theme currently in use
   * will send to `chrome.storage.local` to trigger actual page modification
   *
   * @params theme { String | Object }
   *    The theme object or its name.
   *    Will do nothing if a string is given but can not be found from `allThemes`
   */
  setTheme(theme) {
    if (typeof(theme) === 'string') {
      theme = CGC.allThemes.find(t => t.name === theme)
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
   *    Will do nothing if a string is given but can not be found from `allThemes`
   */
  deleteTheme(theme) {
    if (typeof(theme) === 'string') {
      theme = CGC.allThemes.find(t => t.name == theme)
    }
    if (!theme) return

    let ind = CGC.allThemes.indexOf(theme)
    if (ind == -1) return

    CGC.allThemes.splice(ind, 1)
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
   * Create a default theme and add it into `allThemes`
   * the new copy of default theme will be returned
   * this new theme will be save to `chrome.storage.sync`
   */
  addNewTheme() {
    if (CGC.allThemes === null) {
      console.error("Themes are not initialized! Failed to add a new one.")
      return
    }

    let theme = CGC.defaultTheme.copy()
    CGC.allThemes.push(theme)
    CGC.saveThemes()
    return theme
  },

  getTheme(themeName) {
    return CGC.allThemes.find(th => th.name === themeName)
  },

  ///////////////////////////////////
  // Themes Management Interface Ends
  ///////////////////////////////////

  ///////////////////////////////////
  // Icon & Poster Management Interface
  ///////////////////////////////////
  /*
   * Traverse the extension folder (non-recursively)
   *
   * @params path { String }
   * @params filter { Function }
   *         @param { FileEntry } file, `FileEntry`: https://developer.mozilla.org/en-US/docs/Web/API/FileSystemEntry
   *         @return { Boolean } filter this file out if `true`
   *         e.g. file => file.name.endsWith('png')
   * @params cb: { Function }
   *         @param { File } file - each file will be called with callback, `File`: https://developer.mozilla.org/en-US/docs/Web/API/File
   *         @param { Boolean } is_last - whether current file is the last
   *
   *  if there is no file, `cb` will be called immediately with cb(null, true)
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

          if (files.length === 0) {
            cb(null, true)
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
    function loadPredefinedIcons(then) {
      CGC.traverseDir('icons',
          file => file.name.match(/png|jpg|jpeg|ico$/),
          (file, is_last_file) => {
            if (file === null) then()   // empty folder
            else {
              CGC.readFileAsDataURL(file, event => {
                predCb(event.target.result, file.name)
                if (is_last_file) then()
              })
            }
          }
        )
    }

    // Display all user icon files
    function loadUserIcons(){
      chrome.storage.sync.get({'CGC_user_icons': []}, obj => {
        for (let [date, dataURL] of obj['CGC_user_icons']) {
          userCb(dataURL, date)
        }
      })
    }

    // put all user icons after predefined ones, so that they do not mix up
    loadPredefinedIcons(loadUserIcons)
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
  },
  ///////////////////////////////////
  // Icon & Poster Management Interface Ends
  ///////////////////////////////////

  ///////////////////////////////////
  // Image Processing Util
  ///////////////////////////////////
  resizeImg(dataURL, width, height, cb) {
    let img = new Image()
    img.src = dataURL

    let canvas = document.createElement("canvas")
    let ctx = canvas.getContext("2d")
    canvas.width = width
    canvas.height = height

    img.addEventListener('load', () => {
      ctx.drawImage(img, 0, 0, width, height)
      cb(canvas.toDataURL())
    })
  },

  splitImg(dataURL, cropWidth, cropHeight, cb) {
    let img = new Image()
    img.src = dataURL

    let canvas = document.createElement("canvas")
    let ctx = canvas.getContext("2d")
    canvas.width = cropWidth
    canvas.height = cropHeight

    img.addEventListener('load', () => {
      for (let x = 0; x < img.width; x += cropWidth) {
        for (let y = 0; y < img.height; y += cropHeight) {
          ctx.drawImage(img, x, y, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)
          cb(canvas.toDataURL())
        }
      }
    })
  }
}
