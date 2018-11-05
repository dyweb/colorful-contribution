/*
* @Author: gigaflw
* @Date:   2018-09-09 22:39:44
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-11-05 13:53:40
*/

window.CGC_util = {
  range(beg, end, step = 1) {
    let ret = []
    while (beg < end) {
      ret.push(beg)
      beg += step
    }
    return ret
  },

  // @param   { Array[Number] } rgb
  //    each in range [0, 255]
  // @return  { Array[Number] } hsl
  //    [h, s, l], each in range [0, 1]
  rgb2hsl(rgb){
    let [r, g, b] = rgb
    r /= 255, g /= 255, b /= 255

    let max = Math.max(r, g, b), min = Math.min(r, g, b)
    let h, s, l = (max + min) / 2

    if(max == min){
        h = s = 0; // achromatic
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h, s, l];
  },

  // @param   { String } rgbStr
  //    e.g. "rgb(111, 222, 123)"
  // @return  { Array[Number] } hsl
  //    [h, s, l], each in range [0, 1]
  rgbStr2hsl(rgbStr) {
    let match = rgbStr.match(/rgb\((\w+),?\s*(\w+),?\s*(\w+),?\s*\)/)
    if (!match) throw new Error("Can not parse rgb str: " + rgbStr + ", expected e.g. 'rgb(10, 255, 100)'");
    return CGC_util.rgb2hsl(match.slice(1, 4).map(x => parseInt(x)))
  },

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