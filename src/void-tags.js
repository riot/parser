const html = [
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
const svg = [
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
export default {
  /**
   * HTML void elements that cannot be auto-closed and shouldn't contain child nodes.
   *
   * basefont, bgsound, command, frame, isindex, nextid, nobr are not html5 elements.
   *
   * @const {Array.<string>}
   * @see   {@link http://www.w3.org/TR/html-markup/syntax.html#syntax-elements}
   * @see   {@link http://www.w3.org/TR/html5/syntax.html#void-elements}
   */
  html,
  /**
   * SVG void elements that cannot be auto-closed and shouldn't contain child nodes.
   *
   * @const {Array.<string>}
   */
  svg,
  // Regex to match all of them
  regex: new RegExp(`^/?(?:${html.join('|')}|${svg.join('|')})$`, 'i')
}
