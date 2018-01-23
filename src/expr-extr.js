/*
 * Mini-parser for expressions.
 * The main pourpose of this module is to find the end of an expression
 * and return its text without the enclosing brackets.
 * Does not works with comments, but supports ES6 template strings.
 */
import skipRegex from 'skip-regex'
import escapeStr from './escape-str'
import skipES6TL, { $_ES6_BQ } from './skip-es6-tl'
/**
 * @exports exprExtr
 */
const S_SQ_STR = /'[^'\n\r\\]*(?:\\(?:\r\n?|[\S\s])[^'\n\r\\]*)*'/.source
/**
   * Matches double quoted JS strings taking care about nested quotes
   * and EOLs (escaped EOLs are Ok).
   *
   * @const
   * @private
   */
const S_STRING = `${S_SQ_STR}|${S_SQ_STR.replace(/'/g, '"')}`
/**
   * Regex cache
   *
   * @type {Object.<string, RegExp>}
   * @const
   * @private
   */
const reBr = {}
/**
   * Makes an optimal regex that matches quoted strings, brackets, backquotes
   * and the closing brackets of an expression.
   *
   * @param   {string} b - Closing brackets
   * @returns {RegExp}
   */
function _regex(b) {
  let re = reBr[b]
  if (!re) {
    let s = escapeStr(b)
    if (b.length > 1) {
      s = s + '|['
    } else {
      s = /[{}[\]()]/.test(b) ? '[' : `[${s}`
    }
    reBr[b] = re = new RegExp(`${S_STRING}|${s}\`/\\{}[\\]()]`, 'g')
  }
  return re
}
/**
   * Parses the code string searching the end of the expression.
   * It skips braces, quoted strings, regexes, and ES6 template literals.
   *
   * @function exprExtr
   * @param   {string}  code  - Buffer to parse
   * @param   {number}  start - Position of the opening brace
   * @param   {[string,string]} bp - Brackets pair
   * @returns {(Object | null)} Expression's end (after the closing brace) or -1
   *                            if it is not an expr.
   */
export default function exprExtr(code, start, bp) {
  const openingBraces = bp[0]
  const closingBraces = bp[1]
  const offset = start + openingBraces.length // skips the opening brace
  const stack = [] // expected closing braces ('`' for ES6 TL)
  const re = _regex(closingBraces)
  re.lastIndex = offset // begining of the expression
  let idx
  let end
  let str
  let match
  while ((match = re.exec(code))) {
    idx = match.index
    end = re.lastIndex
    str = match[0]
    if (str === closingBraces && !stack.length) {
      return {
        text: code.slice(offset, idx),
        start,
        end,
      }
    }
    str = str[0]
    switch (str) {
    case '[':
    case '(':
    case '{':
      stack.push(str === '[' ? ']' : str === '(' ? ')' : '}')
      break
    case ')':
    case ']':
    case '}':
      if (str !== stack.pop()) {
        throw new Error(`Unexpected character '${str}'`)
      }
      if (str === '}' && stack[stack.length - 1] === $_ES6_BQ) {
        str = stack.pop()
      }
      end = idx + 1
      break
    case '/':
      end = skipRegex(code, idx)
      break
    }
    if (str === $_ES6_BQ) {
      re.lastIndex = skipES6TL(code, end, stack)
    }
    else {
      re.lastIndex = end
    }
  }
  if (stack.length) {
    throw new Error('Unclosed expression.')
  }
  return null
}