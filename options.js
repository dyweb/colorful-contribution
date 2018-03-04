/*
* @Author: gigaflw
* @Date:   2018-03-03 15:49:50
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-03-04 11:12:46
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
    chrome.storage.sync.get({'CGC_user_icons': []}, obj => {
      let ind = obj['CGC_user_icons'].findIndex(icon => icon[0] == iconId)
      if (ind === -1) return
      elem.parentNode.removeChild(elem)
      obj['CGC_user_icons'].splice(ind, 1)
      chrome.storage.sync.set({'CGC_user_icons': obj['CGC_user_icons']})
    })
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

      chrome.storage.sync.get({'CGC_user_icons': []}, obj => {
        obj['CGC_user_icons'].push([iconId, dataURL])
        chrome.storage.sync.set({'CGC_user_icons': obj['CGC_user_icons']})
      })
    })
  })
  // event listeners end
  /////////////////////

  CGC.getIcons(
    (dataURL, fileName) => appendIcon(dataURL, fileName, false), // predefined icons are not deleteable
    (dataURL, date) => appendIcon(dataURL, date, true),
  )
}()
