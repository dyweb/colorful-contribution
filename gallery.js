/*
* @Author: gigaflw
* @Date:   2018-03-03 15:49:50
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-10-18 11:37:26
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
    addFileBtn: document.getElementById("icon-gallery").querySelector(".js-add-file-btn")
  },
  poster: {
    input: document.getElementById("poster-form").children[0],
    gallery: document.getElementById("poster-gallery"),
    addFileBtn: document.getElementById("poster-gallery").querySelector(".js-add-file-btn"),
  },
}

function insertBeforeLastChild(parent, elem) {
  if (parent.lastElementChild) {
    parent.insertBefore(elem, parent.lastElementChild)
  } else {
    parent.appendChild(elem)
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
function debounce(func, idleMs=1000) {
  let timer = null
  return function(...args) {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => func(...args), idleMs)
  }
}

!function(){
  /////////////////////
  // util funtions 
  function appendIcon(id, imgElem, deleteable=true){
      let container = document.createElement('div')
      container.classList.add('icon')
      container.appendChild(imgElem)
      imgElem.classList.add('img')

      if (deleteable) {
        let delBtn = document.createElement('div')
        delBtn.classList.add('del-btn')
        delBtn.classList.add('cross')
        delBtn.addEventListener('click', event => {
          CGC.removeIcon(id)
          container.parentNode.removeChild(container)
        })
        container.appendChild(delBtn)
      }

      container.setAttribute('data-id', id)
      insertBeforeLastChild(galleries.icon.gallery, container)
  }

  function appendPoster(id, imgElem, deleteable=true){
      let container = document.createElement('div')
      container.classList.add('poster')
      container.appendChild(imgElem)
      imgElem.classList.add('img')

      if (deleteable) {
        let delBtn = document.createElement('div')
        delBtn.classList.add('del-btn')
        delBtn.classList.add('cross')
        delBtn.addEventListener('click', event => {
          CGC.removePoster(id)
          container.parentNode.removeChild(container)
        })
        container.appendChild(delBtn)
      }

      container.setAttribute('data-id', id)
      insertBeforeLastChild(galleries.poster.gallery, container)
  }
  // util functions end
  /////////////////////

  /////////////////////
  // event listeners
  for (let key in galleries) {

    !function(){
      let uploadFunc = CGC['upload' + {icon: 'Icon', poster: 'Poster'}[key]]
      let appendFunc = {icon: appendIcon, poster: appendPoster}[key]

      let addFileBtn = galleries[key].addFileBtn
      let input = galleries[key].input

      addFileBtn.addEventListener('click', event => input.click())
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

    urlInput.addEventListener('input', debounce(event => {
      clearErrorPrompt()
      let url = event.target.value
      if (!url) return
      let prompt = _PosterTheme.checkWebURL(url)
      prompt ? showErrorPrompt(prompt) : previewInputURL(url)
    }))
  }()
  // event listeners end
  /////////////////////

  // Add icons & posters to gallery

  CGC.getIconAsImgs(
    (id, imgElem) => appendIcon(id, imgElem, false), // predefined icons are not deleteable
    (id, imgElem) => appendIcon(id, imgElem),
  )

  CGC.getPosterAsImgs(
    (id, imgElem) => appendPoster(id, imgElem, false), // predefined icons are not deleteable
    (id, imgElem) => appendPoster(id, imgElem),
  )
}()
