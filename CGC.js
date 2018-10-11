/*
* @Author: gigaflw
* @Date:   2018-01-22 21:46:54
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-10-11 12:09:29
*/

// CGC means colorful github contributino
// window.CGC is the collection of global states/methods
// 
// Calling relationship:
// popup.js -- Themes Management Interface -----> CGC.js  -- `sendTheme()` -->  content.js
// gallery.js  -- Icon Management Interface -/

console.assert(typeof Theme !== 'undefined', "`Theme` not found, include `theme.js` before `CGC.js`")
console.assert(typeof CGC_util !== 'undefined', "`CGC_util` not found, include `util.js` before `CGC.js`")

Theme.DEFAULT_THRESHOLDS = [0, 3, 5, 8, 10] // 0 => patterns[0], 1,2,3 => patterns[1], etc.

window.CGC = {  // ok to add a variable to `window` since this `window` is private to this extension

  version: chrome.runtime.getManifest().version,

  // the threshold used by github default contribution coloring, ranged from 0 to 10
  // non-customizeable for now
  defaultThresholds: Theme.DEFAULT_THRESHOLDS,

  // built-in themes
  defaultThemes: [
    new Theme('Primal',  'chroma').setPatterns(['#eee'   , '#c6e48b', '#7bc96f', '#239a3b', '#196127']),    // the color used by GitHub
    new Theme('Cherry',  'chroma').setPatterns(['#eee'   , '#f8bbd0', '#f06292', '#e91e63', '#c2185b']),
    new Theme('Tide',    'chroma').setPatterns(['#eee'   , '#c5cae9', '#9fa8da', '#5c6bc0', '#3949ab']),
    new Theme('Solemn',  'chroma').setPatterns(['#eee'   , '#bbb'   , '#888'   , '#555'   , '#111'   ]),
    new Theme('Flower',  'chroma').setPatterns(['#eee', '#c6e48b', '#7bc96f', '#239a3b', 'icons/flower.png']),
    new Theme('Mario',   'chroma').setPatterns(['#eee', 'icons/mario-coin.png', 'icons/mario-star.png', 'icons/mario-fireflower.png', 'icons/mario-1up.png']),
    new Theme('Comet',   'poster').setPoster('posters/qmsht.jpg'),
  ],

  // the default theme when creating new ones
  defaultTheme: new Theme('Newbie', 'chroma').setPatterns(['#aae', '#acc', '#aea', '#cca', '#eaa']),

  //////////////////////////////
  // Themes Management Interface
  //////////////////////////////
  allThemes: null, // globally accessible variable, should be initialized from storage instantly after bootup

  /*
   * Send a theme object to `chrome.storage.local` and carry out content script `content.js`
   * the page will refresh iff this function is executed
   *
   * @params: theme: { object | null }
   *   optional. If not given, the currently selected theme
   *     will be sent according to `chrome.storage.sync`
   */
  sendTheme(theme) {
    function checkTheme() {
      return (theme.type == Theme.CHROMA_TYPE && theme.patterns && theme.patterns.length > 0) ||
             (theme.type == Theme.POSTER_TYPE && theme.poster)
    }

    if (theme === null) {
      chrome.storage.sync.get('CGC_selected', obj => {
        let name = obj['CGC_selected']
        let theme = CGC.allThemes.find(t => t.name === name)
        CGC.sendTheme(theme)
      })
    } else {

      if (!checkTheme()) return
      if (!theme.thresholds) theme.thresholds = CGC.defaultThresholds

      chrome.storage.local.set({
        'CGC': theme.toObject()
      }, () => {
        chrome.tabs.executeScript({file: 'content.js'})
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

  // url may be dataURL or web url
  urlToImg(url) {
    let img = document.createElement('div')
    img.style = `background-image: url(${url})`
    return img
  },

  pathToImg(path) {
    let img = document.createElement('div')
    img.style = `background-image: url(${chrome.extension.getURL(path)})`
    img.dataset.src = path
    return img
  },

  _getImgs(predDir, userKey, predCb, userCb) {
    userCb = userCb || predCb
    if (predDir.endsWith('/')) predDir = predDir.slice(0, -1)

    // Display all predefined images according to `predDir`
    function loadPredefinedImgs(then) {
      CGC.traverseDir(predDir,
          file => file.name.match(/png|jpg|jpeg|ico$/),
          (file, is_last) => {
            if (file === null) then()   // empty folder
            else {
              let path = `${predDir}/${file.name}`,
                  img = CGC.pathToImg(path)
              // add dataset for content script
              img.dataset.src = path
              predCb(file.name, img)
              if (is_last) then()
            }
          }
        )
    }

    // Display all user images according to `userKey`
    // there may be two types of images stored: dataURL or (web) url
    function loadUserImgs(){
      let _query = {}; _query[userKey] = []
      chrome.storage.local.get(_query, obj => {
        for (let [id, url] of obj[userKey]) {
          let img = CGC.urlToImg(url)
          // add dataset for content script
          // do not save url directly because that may be very long
          img.dataset.src = 'url:' + id
          userCb(id, img)
        }
      })
    }

    // put all user images after predefined ones, so that they do not mix up
    // (but they may mix up inside each group because file reading is async)
    loadPredefinedImgs(loadUserImgs)
  },

  /*
   * Load all icons, include predefined ones and user-defined ones.
   * For predefined ones, they are loaded as file names.
   * For user-uploaded ones, they are loaded as dataURL.
   * But anyway, a <div> element whose background image is set to the image
   *   will be returned regardless of the type
   *
   * userCb will only be called after all predefined icons have been called with,
   *   so that they do not mix up
   *
   * if userCb is not given, predCb will be called on user-uploaded icons
   *
   * @params predCb { Function }  -  callback for predefined icons
   *         @params iconId { String }
   *         @params imgElem { HTMLElement }
   * @params userCb { Function | null }  -  callback for user-defined icons
   *         @params iconId { String }
   *         @params imgElem { HTMLElement }
   */
  getIconAsImgs(predCb, userCb) {
    CGC._getImgs('icons', 'CGC_upload_icons', predCb, userCb)
  },

  getPosterAsImgs(predCb, userCb) {
    CGC._getImgs('posters', 'CGC_upload_posters', predCb, userCb)
  },

  uploadIcon(file, cb) {
    CGC_util.readFileAsDataURL(file, event => {
      CGC_util.resizeImg(event.target.result, 16, 16, dataURL => {
        let id = Date.now()
        CGC._addToDataset('CGC_upload_icons', [id, dataURL])
        cb(id, dataURL)
      })
    })
  },

  removeIcon(id) {
    CGC._removeFromDataset('CGC_upload_icons', icon => icon[0] == id)
  },

  uploadPoster(file, cb) {
    CGC_util.readFileAsDataURL(file, event => {
      CGC_util.resizeAndCropImg(event.target.result, 52*16, 7*16, dataURL => {
        let id = Date.now()
        CGC._addToDataset('CGC_upload_posters', [id, dataURL])
        cb(id, dataURL)
      })
    })
  },

  uploadPosterURL(url, id) {
    id = id || Data.now()
    CGC._addToDataset('CGC_upload_posters', [id, url])
  },

  removePoster(id) {
    CGC._removeFromDataset('CGC_upload_posters', poster => poster[0] == id)
  },

  _addToDataset(key, data) {
    let query = {}; query[key] = []
    chrome.storage.local.get(query, obj => {
      obj[key].push(data)
      let newData = {}; newData[key] = obj[key]
      chrome.storage.local.set(newData)
    })
  },

  _removeFromDataset(key, pred, cb) {
    let query = {}; query[key] = []
    chrome.storage.local.get(query, obj => {
      let ind = obj[key].findIndex(pred)
      if (ind === -1) return
      obj[key].splice(ind, 1)
      let newData = {}; newData[key] = obj[key]
      chrome.storage.local.set(newData)
      cb && cb()
    })
  },
  ///////////////////////////////////
  // Icon & Poster Management Interface Ends
  ///////////////////////////////////
}
