/*
* @Author: gigaflw
* @Date:   2018-03-03 15:49:50
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-03-29 09:15:13
*/

/*
 * Here I goofed off by saving user uploaded icon into chrome storage as dataURL,
 *   rather than a real file in extension directory to avoid all the file creation/deletion code
 */

let input = document.getElementById("icon-form").children[0]
let gallery = document.getElementById("icon-gallery")
let addIconBtn = gallery.children[0]

!function(){
  /////////////////////
  // util funtions 
  function appendIcon(imgSrc, iconId, deleteable){
      let div = document.createElement('div')
      div.classList.add('icon')

      let img = document.createElement('img')
      img.src = imgSrc
      div.appendChild(img)

      if (deleteable) {
        let delBtn = document.createElement('div')
        delBtn.classList.add('del-btn')
        delBtn.classList.add('cross')
        delBtn.addEventListener('click', event => removeIcon(div, iconId))
        div.appendChild(delBtn)
      }

      div.setAttribute('data-id', iconId)
      gallery.insertBefore(div, addIconBtn)
      return img
  }

  function removeIcon(elem, iconId) {
    CGC.removeIcon(iconId, () => elem.parentNode.removeChild(elem))
  }

  function resizeImg(dataURL, width, height) {
      let img = new Image()
      img.src = dataURL

      let canvas = document.createElement("canvas")
      let ctx = canvas.getContext("2d")

      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)

      return canvas.toDataURL()
  }
  // util functions end
  /////////////////////

  /////////////////////
  // event listeners
  addIconBtn.addEventListener('click', event => input.click())
  input.addEventListener('change', event => {
    if (!input.files[0]) return

    CGC.readFileAsDataURL(input.files[0], event => {
      let dataURL = resizeImg(event.target.result, 32, 32)
      let iconId = Date.now()
      appendIcon(dataURL, iconId, true)
      CGC.addIcon(iconId, dataURL)
    })
  })
  // event listeners end
  /////////////////////

  CGC.getIcons(
    (dataURL, fileName) => appendIcon(dataURL, fileName, false), // predefined icons are not deleteable
    (dataURL, date) => appendIcon(dataURL, date, true),
  )
}()
