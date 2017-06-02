/**
 * HTML void elements that cannot be auto-closed and shouldn't contain child nodes.
 *
 * @const {RegExp}
 * @see   {@link http://www.w3.org/TR/html-markup/syntax.html#syntax-elements}
 * @see   {@link http://www.w3.org/TR/html5/syntax.html#void-elements}
 */
module.exports = /^\/?(?:area|base|br|col|embed|frame|hr|img|input|keygen|link|meta|param|source|track|wbr)$/i
