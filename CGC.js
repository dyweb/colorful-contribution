/*
* @Author: gigaflw
* @Date:   2018-01-22 21:46:54
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-11-14 19:11:14
*/

// CGC means colorful github contributino
// window.CGC is the collection of global states/methods
// 
// Calling relationship:
// popup.js -- Themes Management Interface -----> CGC.js  -- `sendTheme()` -->  content.js
// gallery.js  -- Icon Management Interface -/


window.CGC = {  // ok to add a variable to `window` since this `window` is private to this extension

  version: chrome.runtime.getManifest().version,

  presetDir: 'presets',
  presetIconDir: 'presets/icons',
  presetPosterDir: 'presets/posters',

  // the default theme when creating new ones
  defaultTheme: new ChromaTheme('Newbie').setPatterns(ChromaTheme.DEFAULT_PATTERNS),

  // built-in themes
  defaultThemes: [
    new ChromaTheme('Primal').setPatterns(['#eee', '#c6e48b', '#7bc96f', '#239a3b', '#196127']),    // the color used by GitHub
    new ChromaTheme('Cherry').setPatterns(['#eee', '#f8bbd0', '#f06292', '#e91e63', '#c2185b']),
    new ChromaTheme('Tide')  .setPatterns(['#eee', '#c5cae9', '#9fa8da', '#5c6bc0', '#3949ab']),
    new ChromaTheme('Solemn').setPatterns(['#eee', '#bbb'   , '#888'   , '#555'   , '#111'   ]),
    new ChromaTheme('Flower').setPatterns(['#eee', '#c6e48b', '#7bc96f', '#239a3b', 'presets/icons/flower.png']),
    new ChromaTheme('Mario') .setPatterns(['#eee', 'presets/icons/mario-coin.png', 'presets/icons/mario-star.png', 'presets/icons/mario-fireflower.png', 'presets/icons/mario-1up.png']),
    new PosterTheme('Ravine').setPoster('presets/posters/arcarum.png'),
  ],

  // deprecated default themes from older versions
  _deletedDefaultThemes: [{
    name: 'Olympic',
    colors: ['#0000ff', '#fff000', '#000000', '#096600', '#ff0000']
  }, {
    name: 'Oreo',
    colors: ['#222', '#fff', '#222', '#fff', '#222']
  }],

  //////////////////////////////
  // Themes Management Interface
  //////////////////////////////
  allThemes: null, // globally accessible variable, should be initialized from storage instantly after bootup

  managers: {}, // created every once the popup is loaded

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
        let id = obj['CGC_selected']
        let theme = CGC.allThemes.find(t => t.id === id)
        CGC.sendTheme(theme)
      })
    } else {

      console.log("CGC> Sending theme: " + theme.name)
      try {
        theme.validate()
      } catch (err) {
        console.error(err.message)
        return
      }

      chrome.storage.local.set({
        'CGC': theme.toObject()
      }, () => {
        chrome.tabs.executeScript({file: 'content/content.js'}) /* content.css is injected by url, not programmatically */
      })
    }
  },

  /*
   * Init `chrome.storage.sync` where permanent user settings are saved
   */
  initStorage() {
    console.log("CGC> Initializing storage...")
    chrome.storage.sync.set({
      'version': CGC.version,
      'CGC_all': CGC.defaultThemes,
      'CGC_selected': null,

      'next_theme_id': 0
    })
  },

  loadStorage(cb) {
    chrome.storage.sync.get(null, obj => {
      if (!obj['version']) {
        // no data, re-init
        CGC.initStorage()
        CGC.allThemes = CGC.defaultThemes
      } else {

        let _versionCmp = versionCmp(obj['version'], CGC.version)
        if (_versionCmp == 1){
          // got newr version from user data than the code, theoretically impossible (except when developing)
          console.warn(`Got new version ${obj['version']} from user data than extension version ${CGC.version}. Are you using the old version?`)
        } else if (_versionCmp == -1){
          // upgrade from older version
          obj = CGC._updateFromOldVersion(obj['version'], obj)
          chrome.storage.sync.set(obj)
        }

        Theme.nextId = obj['next_theme_id']
        CGC.allThemes = obj['CGC_all'].map(obj => Theme.fromObject(obj))
      }

      // theme may contains storage labels
      // When rendering popup (only in which case this function get called)
      //  we prepare all necessary storage stuff before hand
      let whenThemeInited = theme => CGC.managers[theme.id] = new ThemeManager(theme),
          uninitedThemeCnt = CGC.allThemes.length

      CGC.allThemes.forEach(theme => {
        let needWait = theme.waitForStorageCallback(() => {
          whenThemeInited(theme)
          // call cb when all themes inited
          if (--uninitedThemeCnt == 0) cb(obj)
        })
        if (!needWait) {
          whenThemeInited(theme)
          if (--uninitedThemeCnt == 0) cb(obj)
        }
      })
    })
  },

  clearStorage() {
    chrome.storage.sync.clear()
    chrome.storage.local.clear()
  },

  saveThemes() {
    chrome.storage.sync.set({'CGC_all': CGC.allThemes.map(theme => theme.toObject())})
  },

  /*
   * Set the theme currently in use
   * will send to `chrome.storage.local` to trigger actual page modification
   *
   * @params theme { Integer | String | Object }
   *    The theme object or its id or its name.
   *    If name is given, the first theme with that name will be sent
   *    Will do nothing if a string is given but can not be found from `allThemes`
   */
  setTheme(theme) {
    if (typeof(theme) === 'number') theme = CGC.allThemes.find(t => t.id === theme)
    if (typeof(theme) === 'string') theme = CGC.allThemes.find(t => t.name === theme)
    if (!theme) return

    CGC.sendTheme(theme)
    chrome.storage.sync.set({ 'CGC_selected': theme.id })
    return theme
  },

  /*
   * Delete the theme
   * `chrome.storage.sync['CGC_all']` will be changed
   * `chrome.storage.sync['CGC_selected']` will be set to empty string
   *   if it happens to be deleted
   * 
   * @params theme { Integer | String | Object }
   *    The theme object or its id or its name.
   *    If name is given, the first theme with that name will be sent
   *    Will do nothing if a string is given but can not be found from `allThemes`
   */
  deleteTheme(theme) {
    if (typeof(theme) === 'number') theme = CGC.allThemes.find(t => t.id === theme)
    if (typeof(theme) === 'string') theme = CGC.allThemes.find(t => t.name === theme)
    if (!theme) return

    let ind = CGC.allThemes.indexOf(theme)
    if (ind == -1) return

    CGC.allThemes.splice(ind, 1)
    CGC.saveThemes()

    chrome.storage.sync.get('CGC_selected', obj => {
      if (obj['CGC_selected'] === theme.id ) {
        chrome.storage.sync.set({'CGC_selected': null})
      }
    })

    chrome.storage.local.get('CGC', obj => {
      if (obj['CGC'].id === theme.id ) {
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
    if (CGC.allThemes === null) throw new Error("Can not add new theme in to uninitialized allThemes")
    let theme = Theme.createFrom(CGC.defaultTheme)
    CGC.allThemes.push(theme)
    CGC.saveThemes()
    return CGC.managers[theme.id] = new ThemeManager(theme)
  },

  getTheme(id) {
    return CGC.allThemes.find(th => th.id === id)
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

  deletedDefaultImgs: undefined, // we allow user to delete default images, but we just make a marker in case the user would want to recover

  loadDeletedDefaultImgs(cb) {
    if (CGC.deletedDefaultImgs === undefined) {
      chrome.storage.local.get('CGC_deleted_defaults', obj => {
        CGC.deletedDefaultImgs = obj['CGC_deleted_defaults'] || []
        cb && cb(CGC.deletedDefaultImgs)
      })
    } else {
      cb && cb(CGC.deletedDefaultImgs)
    }
  },

  setDeletedDefaultImgs(fileNames) {
    CGC.deletedDefaultImgs = fileNames
    chrome.storage.local.set({'CGC_deleted_defaults': CGC.deletedDefaultImgs})
  },

  addToDeletedDefaultImgs(fileNames) {
    fileNames = (fileNames instanceof Array) ? fileNames : [ fileNames ]
    CGC.loadDeletedDefaultImgs(imgs => {
      CGC.setDeletedDefaultImgs(imgs.concat(fileNames))
    })
  },

  _getImgs(predDir, userKey, predCb, userCb) {
    userCb = userCb || predCb
    if (predDir.endsWith('/')) predDir = predDir.slice(0, -1)

    // Display all predefined images according to `predDir`
    function loadPredefinedImgs(then) {
      CGC.traverseDir(predDir,
          /* filter */ file => {
            let path = `${predDir}/${file.name}`
            return file.name.match(/png|jpg|jpeg|ico$/) && !CGC.deletedDefaultImgs.includes(path)
          },
          /* cb */ (file, is_last) => {
            if (file === null) then()   // empty folder
            else {
              let path = `${predDir}/${file.name}`,
                  img = CGC.pathToImg(path)
              // add dataset for content script
              img.dataset.src = path
              predCb(path, img)
              if (is_last) then()
            }
          }
        )
    }

    // Display all user images according to `userKey`
    // there may be two types of images stored: dataURL or (web) url
    function loadUserImgs(){
      chrome.storage.local.get({[userKey]: []}, obj => {
        for (let [id, url] of obj[userKey]) {
          let img = CGC.urlToImg(url)
          // add dataset for content script
          // do not save url directly because that may be very long
          img.dataset.src = 'storage:' + id
          userCb(id, img)
        }
      })
    }

    // put all user images after predefined ones, so that they do not mix up
    // (but they may mix up inside each group because file reading is async)
    CGC.loadDeletedDefaultImgs(_ => loadPredefinedImgs(loadUserImgs))
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
    CGC._getImgs(CGC.presetIconDir, 'CGC_upload_icons', predCb, userCb)
  },

  getPosterAsImgs(predCb, userCb) {
    CGC._getImgs(CGC.presetPosterDir, 'CGC_upload_posters', predCb, userCb)
  },

  uploadIcon(file, cb) {
    CGC_util.readFileAsDataURL(file, event => {
      CGC_util.resizeImg(event.target.result, 16, 16, dataURL => {
        let id = "usrico_" + Date.now()
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
        let id = "usrposter_" + Date.now()
        CGC._addToDataset('CGC_upload_posters', [id, dataURL])
        cb(id, dataURL)
      })
    })
  },

  uploadPosterURL(url, id) {
    id = id || Date.now()
    CGC._addToDataset('CGC_upload_posters', [id, url])
  },

  recoverIcon() {
    CGC.setDeletedDefaultImgs( CGC.deletedDefaultImgs.filter(img => !img.startsWith(CGC.presetIconDir)) )
    window.location.reload()
  },

  recoverPoster() {
    CGC.setDeletedDefaultImgs( CGC.deletedDefaultImgs.filter(img => !img.startsWith(CGC.presetPosterDir)) )
    window.location.reload()
  },

  removePoster(id) {
    CGC._removeFromDataset('CGC_upload_posters', poster => poster[0] == id)
  },

  _addToDataset(key, data) {
    chrome.storage.local.get({[key]: []}, obj => {
      obj[key].push(data)
      chrome.storage.local.set({[key]: obj[key]})
    })
  },

  _removeFromDataset(key, pred, cb) {
    chrome.storage.local.get({[key]: []}, obj => {
      let ind = obj[key].findIndex(pred)
      if (ind === -1) return
      obj[key].splice(ind, 1)
      chrome.storage.local.set({[key]: obj[key]})
      cb && cb()
    })
  },
  ///////////////////////////////////
  // Icon & Poster Management Interface Ends
  ///////////////////////////////////

  //////////////////////////////
  // Updating
  //////////////////////////////
  _updateFromOldVersion(oldVersion, oldData) {
    if (oldVersion.startsWith('0.2')) {
      console.warn(`CGC> Updating data from old version ${oldVersion}`)
      // no 'next_theme_id' in version in or before 0.2
      oldData['next_theme_id'] = Theme.nextId

      // remove deleted default themes
      {
        let themeEq = (t1, t2) => {
          return t1.name === t2.name && [...Array(t1.colors.length)].every((_, ind) => t1.colors[ind] === t2.colors[ind])
        }
        oldData['CGC_all'] = oldData['CGC_all'].filter(theme => {
          return !CGC._deletedDefaultThemes.some(deleted => themeEq(deleted, theme))
        })
      }

      // themes do not have id in or before 0.2
      oldData['CGC_all'].forEach(theme => theme.id = Theme.getId())

      // CGC_selected is name instead of id in or before 0.2
      {
        let selected = oldData['CGC_all'].find(theme => theme.name === oldData['CGC_selected'])
        oldData['CGC_selected'] = selected ? selected.id : null
      }

      // update each theme
      oldData['CGC_all'].forEach(theme => {
        // no dynamic thresholds then
        theme.thresholds = Theme.DETECTED_THRESHOLDS

        if (!theme.colors) return

        // attr name change from colors to patterns
        theme.patterns = theme.colors.reverse() // reversed order then
        delete theme.colors

        // there was only types of themes then
        theme.type = ChromaTheme.TYPE_STR

        // preset resources path change
        theme.patterns.forEach((pat, ind) => {
          if (pat.startsWith('icons/')) theme.patterns[ind] = pat.replace(/^icons/, CGC.presetIconDir)
        })
      })

      // handle user-uploaded img
      oldData['CGC_user_icons'] && oldData['CGC_user_icons'].forEach(data => { // old key is CGC_user_icons
        let [id, dataURL] = data
        id = "usrico_" + id
        CGC._addToDataset('CGC_upload_icons', [id, dataURL])
      })
      delete oldData['CGC_user_icons']

    } else {
      throw new Error(`CGC> Can not upgrade from ${oldVersion} to unknown version: ${CGC.version}`)
    }

    chrome.storage.local.clear() // local are used to save temp data for html rendering, clear them anyway
    return oldData
  }
}
