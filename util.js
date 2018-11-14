/*
* @Author: gigaflw
* @Date:   2018-09-09 22:39:44
* @Last Modified by:   gigaflw
* @Last Modified time: 2018-11-14 11:03:42
*/

// TODO: determine whether or not to put this into a namespace

/*****************
 * General Utils
 ****************/
function range(beg, end, step = 1) {
  return Array.from(
    function* () { for(; beg < end; beg += step) yield beg }()
  )
}

function zip(pred, ...arrs){
  return [...Array(arrs[0].length)].map((_, ind) => pred(...arrs.map(arr => arr[ind])))
} 

function findAncestor(elem, elemClass, guardPred=null) {
  while (elem && elem.classList) {
    if (elem.classList.contains(elemClass)) return elem
    if (guardPred && guardPred(elem)) break
    elem = elem.parentNode
  }
  return null
}

// Compare vesion string like "0.2" > "0.1.0"
// Number and dot only, no letters considered
// @return 1 if lhs > rhs, -1 is lhs < rhs, 0 if lhs == rhs
function versionCmp(lhs, rhs) {
  [lhs, rhs] = [lhs, rhs].map(str => str.split('.').map(x => parseInt(x)))

  {
    let [shorter, longer] = lhs.length > rhs.length ? [rhs, lhs] : [lhs, rhs]
    shorter.splice(shorter.length, 0, ...[...Array(longer.length - shorter.length)].map(_ => 0)) // pad with 0
  }

  for (let ind = 0, len = lhs.length; ind < len; ++ind) {
    if (lhs[ind] > rhs[ind]) return 1
    else if (lhs[ind] < rhs[ind]) return -1
  }
  return 0
}

/*****************
 * Color Utils
 ****************/
// @param   { Array[Number] } rgb
//    each in range [0, 255]
// @return  { Array[Number] } hsl
//    [h, s, l], each in range [0, 1]
function rgb2hsl(rgb){
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
}

// @param   { String } rgbStr
//    e.g. "rgb(111, 222, 123)"
// @return  { Array[Number] } hsl
//    [h, s, l], each in range [0, 1]
function rgbStr2hsl(rgbStr) {
  let match = rgbStr.match(/rgb\((\w+),?\s*(\w+),?\s*(\w+),?\s*\)/)
  if (!match) throw new Error("Can not parse rgb str: " + rgbStr + ", expected e.g. 'rgb(10, 255, 100)'");
  return rgb2hsl(match.slice(1, 4).map(x => parseInt(x)))
}

/*****************
 * css Utils
 ****************/
// - Flipping
// the delay is set to be slightly longer than the animation duration (500ms)
function addFlip(btnElem, flipElem, cb, delay=600) {
  btnElem.addEventListener('click', event => {
    event.stopPropagation()

    flipElem.classList.remove('is-flipping-up')
    flipElem.classList.add('is-flipping-down')

    window.setTimeout(() => {
      flipElem.classList.remove('is-flipping-down')
      flipElem.classList.add('is-flipping-up')
      cb()
    }, delay)
  })
}

/*****************
 * CGC Utils
 ****************/
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