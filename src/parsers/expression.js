import escapeStr from '../utils/escape-str'
import exprExtr from '../utils/expr-extr'
import panic from '../utils/panic'
import pushText from '../utils/push-text'
import {unexpectedEndOfFile} from '../messages'
/**
 * Find the end of the attribute value or text node
 * Extract expressions.
 * Detect if value have escaped brackets.
 *
 * @param   {ParserState} state  - Parser state
 * @param   {HasExpr} node       - Node if attr, info if text
 * @param   {string} endingChars - Ends the value or text
 * @param   {number} start       - Starting position
 * @returns {number} Ending position
 * @private
 */
export default function expr(state, node, endingChars, start) {
  const re = b0re(state, endingChars)

  re.lastIndex = start // reset re position

  const { unescape, expressions, end } = parseExpressions(state, re)

  if (node) {
    if (unescape) {
      node.unescape = unescape
    }
    if (expressions.length) {
      node.expressions = expressions
    }
  } else {
    pushText(state, start, end, {expressions, unescape})
  }

  return end
}

/**
 * Parse a text chunk finding all the expressions in it
 * @param   {ParserState} state  - Parser state
 * @param   {RegExp} re - regex to match the expressions contents
 * @returns {Object} result containing the expression found, the string to unescape and the end position
 */
function parseExpressions(state, re) {
  const { data, options } = state
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
 * @param   {ParserState} state  - Parser state
 * @param   {string} str - String to search
 * @returns {RegExp} Resulting regex.
 * @private
 */
function b0re(state, str) {
  const { brackets } = state.options
  const re = state.regexCache[str]

  if (re) return re

  const b0 = escapeStr(brackets[0])
  // cache the regex extending the regexCache object
  Object.assign(state.regexCache, { [str]: new RegExp(`(${str})|${b0}`, 'g') })

  return state.regexCache[str]
}