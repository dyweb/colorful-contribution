/*
* @Author: gigaflw
* @Date:   2018-03-03 15:49:50
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-09-13 15:10:03
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
    addBtn: document.getElementById("icon-gallery").children[0]
  },
  poster: {
    input: document.getElementById("poster-form").children[0],
    gallery: document.getElementById("poster-gallery"),
    addBtn: document.getElementById("poster-gallery").children[0]
  },
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
      galleries.icon.gallery.insertBefore(container, galleries.icon.addBtn)
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
      galleries.poster.gallery.insertBefore(container, galleries.poster.addBtn)
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
        uploadFunc(input.files[0], (id, dataURL) => appendFunc(id, CGC.dataURLToImg(dataURL)))
      })
    }()
  }
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
