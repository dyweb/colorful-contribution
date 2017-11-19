/*
 * @Author: gigaflower
 * @Date:   2017-11-19 13:55:57
 * @Last Modified by:   gigaflower
 * @Last Modified time: 2017-11-19 14:43:01
 */

! function () {
  let colors = ['#111', '#555', '#888', '#bbb', '#eee'] // from more to less
  let colorsThreshold = [10, 8, 5, 3, 0];

  function getColor(cnt) {
    let idx = colorsThreshold.findIndex(v => v <= cnt)
    return colors[idx];
  }

  let legends = document.querySelectorAll('.contrib-legend ul.legend > li'),
    days = document.querySelectorAll('.calendar-graph rect.day');

  if (legends.length != colors.length) {
    console.error('There are ' + legends.length + ' legends but ' + color.length + ' colors');
    return
  }

  for (let ind = 0; ind < legends.length; ++ind) {
    legends[ind].style['background-color'] = colors[colors.length - ind]
  }

  for (let d of days) {
    let cnt = d.dataset.count,
      color = cnt && getColor(cnt);
    if (color) d.setAttribute('fill', color);
  }
}()
