/*
* @Author: gigaflw
* @Date:   2018-09-09 22:39:44
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-10-23 09:19:02
*/

window.CGC_util = {
  readFileAsDataURL(file, cb) {
    let reader = new FileReader()
    reader.addEventListener('load', cb)
    reader.readAsDataURL(file)
  },

  resizeImg(dataURL, width, height, cb) {
    let img = new Image()
    img.src = dataURL

    let canvas = document.createElement("canvas")
    let ctx = canvas.getContext("2d")
    canvas.width = width
    canvas.height = height

    img.addEventListener('load', () => {
      ctx.drawImage(img, 0, 0, width, height)
      cb(canvas.toDataURL())
    })
  },

  resizeAndCropImg(dataURL, width, height, cb) {
    function calcCropSize(imgW, imgH, canvasW, canvasH) {
      let imgWHRatio = imgW / imgH,
          canvasWHRatio = canvasW / canvasH

      if (imgWHRatio > canvasWHRatio) {
        // the image is too wide
        return [imgH * canvasWHRatio, imgH]
      } else {
        return [imgW, imgW / canvasWHRatio]
      }
    }

    let img = new Image()
    img.src = dataURL

    let canvas = document.createElement("canvas")
    let ctx = canvas.getContext("2d")
    canvas.width = width
    canvas.height = height

    img.addEventListener('load', () => {
      let [cropW, cropH] = calcCropSize(img.naturalWidth, img.naturalHeight, width, height)
      let cropWBeg = (img.naturalWidth - cropW) / 2,
          cropHBeg = (img.naturalHeight - cropH) / 2
      ctx.drawImage(img, cropWBeg, cropHBeg, cropW, cropH, 0, 0, width, height)
      cb(canvas.toDataURL())
    })
  },

  splitImg(dataURL, cropWidth, cropHeight, cb) {
    let img = new Image()
    img.src = dataURL

    let canvas = document.createElement("canvas")
    let ctx = canvas.getContext("2d")
    canvas.width = cropWidth
    canvas.height = cropHeight

    img.addEventListener('load', () => {
      for (let x = 0; x < img.width; x += cropWidth) {
        for (let y = 0; y < img.height; y += cropHeight) {
          ctx.drawImage(img, x, y, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)
          cb(canvas.toDataURL())
        }
      }
    })
  }
}