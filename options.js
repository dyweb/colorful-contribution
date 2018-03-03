/*
* @Author: gigaflw
* @Date:   2018-03-03 15:49:50
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-03-03 23:28:03
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

  function readFileAsDataURL(file, cb) {
    let reader = new FileReader()
    reader.addEventListener('load', cb)
    reader.readAsDataURL(file) 
  }

  function traverseDir(path, filter, cb){
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

    readFileAsDataURL(input.files[0], event => {
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

  // Display all predefined icon files
  function load_predefined_icons(cb) {
    traverseDir('icons',
        file => file.name.match(/png|jpg|jpeg|ico$/),
        (file, is_last_file) => {
          readFileAsDataURL(file, event => {
            appendIcon(event.target.result, file.name, false) // predefined icons are not deleteable
            if (is_last_file) cb()
          })
        }
      )
  }

  // Display all user icon files
  function load_user_icons(){
    chrome.storage.sync.get({'CGC_user_icons': []}, obj => {
      for (let [date, dataURL] of obj['CGC_user_icons']) {
        appendIcon(dataURL, date, true)
      }
    })
  }

  // put all user icons after predefined ones, so that they do not mix up
  load_predefined_icons(load_user_icons)
}()
