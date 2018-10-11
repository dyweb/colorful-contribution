/*
* @Author: gigaflw
* @Date:   2018-03-03 15:49:50
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-10-09 10:56:53
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
    addBtn: document.getElementById("icon-gallery").querySelector(".js-add-file-btn")
  },
  poster: {
    input: document.getElementById("poster-form").children[0],
    gallery: document.getElementById("poster-gallery"),
    addBtn: document.getElementById("poster-gallery").querySelector(".js-add-file-btn"),
  },
}

function insertBeforeLastChild(parent, elem) {
  if (parent.lastElementChild) {
    parent.insertBefore(elem, parent.lastElementChild)
  } else {
    parent.appendChild(elem)
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

      let addBtn = galleries[key].addBtn
      let input = galleries[key].input

      addBtn.addEventListener('click', event => input.click())
      input.addEventListener('change', event => {
        if (!input.files[0]) return
        uploadFunc(input.files[0], (id, dataURL) => appendFunc(id, CGC.urlToImg(dataURL)))
      })
    }()
  }

  // alternate input for poster (we allow user to type an url for poster)
  !function() {
    let gal = galleries.poster.gallery,
        btnGroup = gal.querySelector('.btn-group'),
        toggleEditBtn = gal.querySelector('.add-btn'),
        saveEditBtn = gal.querySelector('.js-ok-btn'),
        urlInput = gal.querySelector('input'),
        urlImage = gal.querySelector('.poster.url .img'), // may be null
        urlImageId = null,
        urlImageURL = null

    function enterEditing() {
      btnGroup.classList.add('editing')
      toggleEditBtn.dataset['rotating'] = 'right'
    }
    function leaveEditing() {
      btnGroup.classList.remove('editing')
      toggleEditBtn.dataset['rotating'] = 'left'
    }

    toggleEditBtn.addEventListener('click', event => {
      (btnGroup.classList.contains('editing') ? leaveEditing : enterEditing)()
    })

    saveEditBtn.addEventListener('click', event => {
      leaveEditing()
      CGC.uploadPosterURL(urlImageURL, urlImageId)
    })

    urlInput.addEventListener('input', event => {
      if (!urlImage) {
        urlImageId = 'web_img_' + Date.now()
        urlImage = document.createElement('div')
        appendPoster(urlImageId, urlImage, true)
        urlImage.parentNode.classList.add('url')
      }
      urlImageURL = event.target.value
      urlImage.style = `background-image: url(${event.target.value});`
    })
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
