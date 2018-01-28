import exprExtr from '../utils/expr-extr'
import escapeStr from '../utils/escape-str'
import panic from '../utils/panic'
import { unexpectedEndOfFile } from '../messages'
import { pushText } from './text'
/**
 * Find the end of the attribute value or text node
 * Extract expressions.
 * Detect if value have escaped brackets.
 *
 * @param   {ParserStore} store  - Parser store
 * @param   {HasExpr} node      - Node if attr, info if text
 * @param   {string} endingChars - Ends the value or text
 * @param   {number} pos        - Starting position
 * @returns {number} Ending position
 * @private
 */
export function expr(store, node, endingChars, start) {
  const re = b0re(store, endingChars)

  re.lastIndex = start // reset re position

  const { unescape, expressions, end } = parseExpressions(store, re)

  if (node) {
    if (unescape) {
      node.unescape = unescape
    }
    if (expressions.length) {
      node.expressions = expressions
    }
  } else {
    pushText(store, start, end, {expressions, unescape})
  }

  return end
}

/**
 * Parse a text chunk finding all the expressions in it
 * @param   {ParserStore} store  - Parser store
 * @param   {RegExp} re - regex to match the expressions contents
 * @returns {object} result containing the expression found, the string to unescape and the end position
 */
function parseExpressions(store, re) {
  const { data, options } = store
  const { brackets } = options
  const expressions = []
  let unescape, pos, match

  // Anything captured in $1 (closing quote or character) ends the loop...
  while ((match = re.exec(data)) && !match[1]) {
    // ...else, we have an opening bracket and maybe an expression.
    pos = match.index
    if (data[pos - 1] === '\\') {
      unescape = match[0] // it is an escaped opening brace
    } else {
      const tmpExpr = exprExtr(data, pos, brackets)
      if (tmpExpr) {
        expressions.push(tmpExpr)
        re.lastIndex = tmpExpr.end
      }
    }
  }

  // Even for text, the parser needs match a closing char
  if (!match) {
    panic(data, unexpectedEndOfFile, pos)
  }

  return {
    unescape,
    expressions,
    end: match.index
  }
}



/**
 * Creates a regex for the given string and the left bracket.
 * The string is captured in $1.
 *
 * @param   {ParserStore} store  - Parser store
 * @param   {string} str - String to search
 * @returns {RegExp} Resulting regex.
 * @private
 */
function b0re(store, str) {
  const { brackets } = store.options
  const re = store.regexCache[str]

  if (re) return re

  const b0 = escapeStr(brackets[0])
  // cache the regex extending the regexCache object
  Object.assign(store.regexCache, { [str]: new RegExp(`(${str})|${b0}`, 'g' ) })

  return store.regexCache[str]
}