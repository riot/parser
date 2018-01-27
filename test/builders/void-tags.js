/**
 * HTML void elements that cannot be auto-closed and shouldn't contain child nodes.
 *
 * @const {RegExp}
 * @see   {@link http://www.w3.org/TR/html-markup/syntax.html#syntax-elements}
 * @see   {@link http://www.w3.org/TR/html5/syntax.html#void-elements}
 */

// basefont, bgsound, command, frame, isindex, nextid, nobr are not
// html5 elements
const htmlTags = [
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'keygen',
  'link',
  'menuitem',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
]

const svgTags = [
  'circle',
  'ellipse',
  'line',
  'path',
  'polygon',
  'polyline',
  'rect',
  'stop',
  'use'
]

module.exports = new RegExp(`^/?(?:${htmlTags.join('|')}|${svgTags.join('|')})$`, 'i')
module.exports.htmlTags = htmlTags
module.exports.svgTags  = svgTags
