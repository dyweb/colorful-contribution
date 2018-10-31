/*
* @Author: gigaflw
* @Date:   2018-03-03 15:49:50
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-10-31 15:23:59
*/

/*
 * Here I goofed off by saving user uploaded icon into chrome storage as dataURL,
 *   rather than a real file in extension directory to avoid all the file creation/deletion code
 */

// TODO: display storage usage

let galleries = {
  icon: {
    input: document.getElementById("icon-form").children[0],
    gallery: document.getElementById("icon-gallery"),
    addFileBtn: document.getElementById("icon-gallery").querySelector(".js-add-file-btn"),
    recoverBtn: document.getElementById("icon-gallery").querySelector(".js-recover-btn")
  },
  poster: {
    input: document.getElementById("poster-form").children[0],
    gallery: document.getElementById("poster-gallery"),
    addFileBtn: document.getElementById("poster-gallery").querySelector(".js-add-file-btn"),
    recoverBtn: document.getElementById("poster-gallery").querySelector(".js-recover-btn")
  },
}

function insertBeforeLastChild(parent, elem, ind=1) {
  let target = parent.lastElementChild
  if (!target) {
    parent.appendChild(elem)
  } else {

    while (target.previousElementSibling && ind > 1) {
      target = target.previousSibling
      ind -= 1
      while (target.nodeType !== Node.ELEMENT_NODE && target.previousSibling) target = target.previousSibling
    }
    parent.insertBefore(elem, target)
  }
}

// Verify whether an image is valid by testing it on an Image elem
let urlVerifier = new Image()
function verifyImageURL(url, onload, onerror, ontimeout, timeout=1000) {
  let verified = 'unknown'
  let timer = window.setTimeout(function(){
    if (verified == 'unknown') {
      ontimeout()
      urlVerifier.onload = urlVerifier.onerror = null
    }
  }, timeout)

  urlVerifier.onload = function(){
    onload()
    verified = 'yes'
    window.clearTimeout(timer)
  }
  urlVerifier.onerror = function() {
    onerror()
    verified = 'no'
    window.clearTimeout(timer)
  }

  urlVerifier.src = url
}

// debounce the call of some function
// all but the last one of consecutive calls in `idle` ms will be ignored
function debounce(func, nowaitIf, idleMs=1000) {
  let timer = null
  return function(...args) {
    window.clearTimeout(timer)
    if (nowaitIf && nowaitIf(...args)) {
      func(...args)
    } else {
      timer = window.setTimeout(() => func(...args), idleMs)
    }
  }
}

!function(){
  /////////////////////
  // util funtions
  function _appendImg(type, id, imgElem, deleteFunc) {
    let container = document.createElement('div')
    container.classList.add(type)
    container.appendChild(imgElem)
    imgElem.classList.add('img')

    if (deleteFunc) {
      let delBtn = document.createElement('div')
      delBtn.classList.add('del-btn')
      delBtn.classList.add('cross')
      delBtn.addEventListener('click', event => {
        if (!confirm("Do you want to delete this picture?")) return
        deleteFunc(event)
        container.parentNode.removeChild(container)
      })
      container.appendChild(delBtn)
    }

    container.setAttribute('data-id', id)
    insertBeforeLastChild(galleries[type].gallery, container, {'icon': 2, 'poster': 1}[type]) // insert before buttons
  }

  let appendIcon   = _appendImg.bind(null, 'icon'),
      appendPoster = _appendImg.bind(null, 'poster')

  // util functions end
  /////////////////////

  /////////////////////
  // event listeners
  for (let key in galleries) {
    let _cap = {icon: 'Icon', poster: 'Poster'}[key]

    !function(){
      let uploadFunc = CGC['upload' + _cap],
          recoverFunc = CGC['recover' + _cap],
          appendFunc = {icon: appendIcon, poster: appendPoster}[key]

      let addFileBtn = galleries[key].addFileBtn,
          recoverBtn = galleries[key].recoverBtn,
          input = galleries[key].input

      addFileBtn.addEventListener('click', event => input.click())
      recoverBtn.addEventListener('click', event => {
        if (confirm("Do you want to recover the deleted default picture?")) recoverFunc()
      })
      input.addEventListener('change', event => {
        if (!input.files[0]) return
        uploadFunc(input.files[0], (id, dataURL) => appendFunc(id, CGC.urlToImg(dataURL)))
      })
    }()
  }

  // web url input logic for poster (we allow user to type an url for poster)
  !function() {
    let gal = galleries.poster.gallery,
        btnGroup = gal.querySelector('.btn-group'),
        toggleEditBtn = btnGroup.querySelector('.add-btn'),
        saveEditBtn = btnGroup.querySelector('.js-ok-btn'),
        errorPrompt = btnGroup.querySelector('.error-prompt'),
        urlInput = btnGroup.querySelector('input'),
        urlImageId = null,
        urlImageURL = null

    function enterEditing() {
      btnGroup.classList.add('editing')
      toggleEditBtn.dataset['rotating'] = 'right'
    }
    function leaveEditing() {
      btnGroup.classList.remove('editing')
      toggleEditBtn.dataset['rotating'] = 'left'
      urlInput.value = ''
      clearErrorPrompt()
      let poster = gal.querySelector('.poster.editing')
      if (poster) poster.classList.remove('editing')
    }

    toggleEditBtn.addEventListener('click', event => {
      if (!btnGroup.classList.contains('editing')){
        enterEditing()
      } else {
        let urlImage = gal.querySelector('.poster.editing')
        if (urlImage) gal.removeChild(urlImage)
        leaveEditing()
      }
    })

    saveEditBtn.addEventListener('click', event => {
      leaveEditing()
      CGC.uploadPosterURL(urlImageURL, urlImageId)
    })

    // when clicking on the button to choose from directory
    // save the current url
    galleries['poster'].addFileBtn.addEventListener('click', event => {
      if (!gal.querySelector('.poster.editing')) return
      leaveEditing()
      CGC.uploadPosterURL(urlImageURL, urlImageId)
    })

    function showErrorPrompt(prompt) { errorPrompt.innerHTML = prompt }
    function clearErrorPrompt() { errorPrompt.innerHTML = '' }

    function previewInputURL(url, checkFirst=true) {
      if (checkFirst) {
        showErrorPrompt('Loading...')
        let onload = () => clearErrorPrompt() || previewInputURL(url, false) // show the image if the url is valid
        let onerror = () => showErrorPrompt('Can not load the image...')     // do nothing when invalid
        let ontimeout = onload     // ascribe timeout to network delay, show it anyway to notify the user that we are loading
        verifyImageURL(url, onload, onerror, ontimeout)
        return
      }

      // checked, the url is a valid image, we show the image
      let urlImage = gal.querySelector('.poster.editing .img')
      if (!urlImage) {
        urlImageId = 'web_img_' + Date.now()
        urlImage = document.createElement('div')
        appendPoster(urlImageId, urlImage, true)
        urlImage.parentNode.classList.add('editing')
      }
      urlImageURL = url
      urlImage.style = `background-image: url(${url});`
    }

    urlInput.addEventListener('input', debounce(
      event => { // no wait if the url is complete
        let url = event.target.value
        return url.match(PosterTheme._WEB_URL_REG)
      },
      event => {
        clearErrorPrompt()
        let url = event.target.value
        if (!url) return
        let prompt = PosterTheme.checkWebURL(url)
        prompt ? showErrorPrompt(prompt) : previewInputURL(url)
      }),
    )
  }()
  // event listeners end
  /////////////////////

  // Add icons & posters to gallery
  CGC.getIconAsImgs(
    (id, imgElem) => appendIcon(id, imgElem, _ => CGC.addToDeletedDefaultImgs(id)),
    (id, imgElem) => appendIcon(id, imgElem, _ => CGC.removeIcon(id)),
  )

  CGC.getPosterAsImgs(
    (id, imgElem) => appendPoster(id, imgElem, _ => CGC.addToDeletedDefaultImgs(id)),
    (id, imgElem) => appendPoster(id, imgElem, _ => CGC.removePoster(id)),
  )
}()
