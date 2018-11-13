/*
 * @Author: gigaflower
 * @Date:   2017-11-19 13:55:57
 * @Last Modified by:   gigaflw
 * @Last Modified time: 2018-11-13 10:15:48
 */

////////////////
// Utils
////////////////

function selectTheme(themeId) {
  if (!themeId) return

  Object.values(CGC.managers).filter(manager => manager instanceof ThemeManager).forEach(manager => {
    if (manager.theme.id !== themeId) {
      manager.reset()
    } else {
      manager.setSelected()
      CGC.setTheme(manager.theme)
      console.log("CGC> Selected theme " + manager.theme.name)
    }
  })
}

function getEditingThemeBlock() {
  return document.querySelector('.theme-block.editing')
}

function getEditingThemeManager() {
  let themeBlock = getEditingThemeBlock()
  return CGC.managers[Number.parseInt(themeBlock.dataset.themeId)]
}
////////////////
// Utils End
////////////////

// Foot Panel ( bind foot panel first to ensure the functionality of resetting )
function initFootPanel() {
  let themePanel = document.getElementById('theme-panel'),
      footPanel = document.getElementById('foot-panel')

  let addBtn = footPanel.querySelector('.add-btn'),
      undoBtn = footPanel.querySelector('.undo-btn')
  addBtn.addEventListener('click', event => {
    let manager = CGC.addNewTheme()
    manager.bindEvents()
    CGC._initManagerEventCb(manager)
    themePanel.appendChild(manager.themeBlock)
    manager.setEditMode(true)
    if (manager.isChroma()) CGC.managers['_CGC_<palette>'].setChained(true)
  })
  undoBtn.addEventListener('click', event => {
    if (undoBtn.classList.contains('warning')) {
      CGC.clearStorage()
      window.location.reload()
    } else {
      undoBtn.classList.add('warning')
    }
  })
  footPanel.addEventListener('mouseleave', event => {
    undoBtn.classList.remove('warning')
  })
}

/*
 * initialize popup html
 */
function initPopup() {
  let themePanel = document.getElementById('theme-panel')
  let galleries = document.getElementById('galleries')

  // Theme panel
  {
    let fragment = document.createDocumentFragment()
    Object.values(CGC.managers).forEach(manager => {
      fragment.appendChild(manager.themeBlock)
    })
    themePanel.appendChild(fragment)
  }

  // Click event for theme panel
  // Select the theme when clicking on it
  themePanel.addEventListener('click', event => {
    let elem = event.target
    if (['theme-block', 'theme-editor', 'theme-name'].some(
        cls => findAncestor(elem, cls, /* guardPred */ e => e === themePanel)
      )){
      elem = findAncestor(elem, 'theme-block')
      selectTheme(Number.parseInt(elem.dataset.themeId)) // every .theme-block should have a data-theme-id field
    }
  })

  // Palette
  let palette = CGC.managers['_CGC_<palette>'] = new Palette(document.getElementById('palette'))
  palette.bindEvents()

  // Icon gallery
  let iconGallery = CGC.managers['_CGC_<iconGallery>'] = new IconGallery(document.getElementById('icon-gallery'))
  iconGallery.bindEvents()

  // Poster gallery
  let posterGallery = CGC.managers['_CGC_<posterGallery>'] = new PosterGallery(document.getElementById('poster-gallery'))
  posterGallery.bindEvents()

  // bind event (especially ones which involves non-local elem)
  CGC._initManagerEventCb = manager => {
    // shift galleries when changing theme type
    manager.setEventCb('flipThemeType', targetType => {
      galleries.dataset.typeName = targetType // flip the gallery (will show animation)
    })
    // move galleries right below the theme block
    manager.setEventCb('enterEditMode', () => {
      galleries.dataset.typeName = manager.themeBlock.dataset.typeName
      manager.themeBlock.insertAdjacentElement('afterend', galleries)
      CGC.managers['_CGC_<palette>'].reset()
    })

    // change hexagon colors when colors are change through color inputs
    manager.setEventCb('colorInput', (ind, colorStr) => {
      if (manager.isEditing()) palette.setHexagonColor(ind, colorStr)
    })
    // select the hexagon when clicking on the pattern block
    manager.setEventCb('clickPatternBlock', (ind, patternBlock) => {
      if (manager.isEditing()) palette.hexagons[ind].click()
    })
  }

  Object.values(CGC.managers).filter(man => man instanceof ThemeManager).forEach(manager => {
    manager.bindEvents()
    CGC._initManagerEventCb(manager)
  })

  // bind tab flipping
  let tab = findAncestor(iconGallery.gallery, 'tab')
  for (let btn of [iconGallery.flipBtn, palette.flipBtn]) {
    addFlip(
      btn,     // when clicking this
      tab,     // flip this
      () => {  // and do this in the middle
        tab.classList.toggle('hide-nth-child-1')
        tab.classList.toggle('hide-nth-child-2')
      }
    )
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initFootPanel() // init foot panel first to ensure the functionality of resetting

  CGC.loadStorage(data => {
    console.log("CGC> Initializing popup...")
    initPopup()
    console.log("CGC> Popup initialized.")
    selectTheme(data['CGC_selected'])
  })
})
