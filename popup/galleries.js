/*
* @Author: gigaflw
* @Date:   2018-11-06 10:09:55
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-11-08 22:40:37
*/

class IconGallery {
  constructor(galleryElem) {
    this.gallery = galleryElem
    this.flipBtn = galleryElem.querySelector('.js-flip-btn')

    CGC.getIconAsImgs((id, imgElem) => {
      imgElem.classList.add('icon')
      galleryElem.appendChild(imgElem)
    })
  }

  bindEvents() {
    this.gallery.addEventListener('click', event => {
      // do nothing if not clcking on the icons
      if (!event.target.classList.contains('icon')) return

      let icon = event.target,
        manager = getEditingThemeManager()

      // validate
      if (!icon.dataset.src) {
        console.warn("IconGallery> icon without data-src is invalid: ")
        console.log(icon)
        return
      }

      // set the content of patternBlock to icon
      let patternBlock = manager.getEditingPatternBlock()

      patternBlock.style = `background-image: url(${icon.dataset.src})`
      manager.colorInput.value = '<icon>'

      manager.theme.setThemeType('chroma')
      manager.theme.setPattern(manager.getEditingPatternBlockIdx(), icon.dataset.src)
      CGC.saveThemes()
      if (manager.isSelected()) CGC.sendTheme(manager.theme)
    })
  }
}

class PosterGallery {
  constructor(galleryElem) {
    this.gallery = galleryElem

    CGC.getPosterAsImgs((id, imgElem) => {
      // add backup incase the poster url is invalid
      imgElem.style['background-image'] += ", linear-gradient(90deg, white, black)"

      imgElem.classList.add('poster')
      galleryElem.appendChild(imgElem)
    })
  }

  bindEvents() {
    this.gallery.addEventListener('click', event => {
      // do nothing if not clcking on the posters
      if (!event.target.classList.contains('poster')) return

      let poster = event.target,
        manager = getEditingThemeManager()

      manager.theme.setThemeType('poster')
      manager.theme.setPoster(poster.dataset.src)
      manager.setPoster(poster.style['background-image'], {title: poster.dataset.src})

      CGC.saveThemes()
      if (manager.isSelected()) CGC.sendTheme(manager.theme)
    })
  }
}