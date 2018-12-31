/*
 * Mini-parser for expressions.
 * The main pourpose of this module is to find the end of an expression
 * and return its text without the enclosing brackets.
 * Does not works with comments, but supports ES6 template strings.
 */
import skipES6TL, {$_ES6_BQ} from './skip-es6-tl'
import {unclosedExpression, unexpectedCharInExpression} from '../messages'
import escapeStr from './escape-str'
import panic from './panic'
import skipRegex from './skip-regex'
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
 * @returns {RegExp} - optimized regex
 */
function _regex(b) {
  let re = reBr[b]
  if (!re) {
    let s = escapeStr(b)
    if (b.length > 1) {
      s = `${s}|[`
    } else {
      s = /[{}[\]()]/.test(b) ? '[' : `[${s}`
    }
    reBr[b] = re = new RegExp(`${S_STRING}|${s}\`/\\{}[\\]()]`, 'g')
  }
  return re
}

/**
 * Update the scopes stack removing or adding closures to it
 * @param   {Array} stack - array stacking the expression closures
 * @param   {string} char - current char to add or remove from the stack
 * @param   {string} idx  - matching index
 * @param   {string} code - expression code
 * @returns {Object} result
 * @returns {Object} result.char - either the char received or the closing braces
 * @returns {Object} result.index - either a new index to skip part of the source code,
 *                                  or 0 to keep from parsing from the old position
 */
function updateStack(stack, char, idx, code) {
  let index = 0

  switch (char) {
  case '[':
  case '(':
  case '{':
    stack.push(char === '[' ? ']' : char === '(' ? ')' : '}')
    break
  case ')':
  case ']':
  case '}':
    if (char !== stack.pop()) {
      panic(code, unexpectedCharInExpression.replace('%1', char), index)
    }

    if (char === '}' && stack[stack.length - 1] === $_ES6_BQ) {
      char = stack.pop()
    }

    index = idx + 1
    break
  case '/':
    index = skipRegex(code, idx)
  }

  return { char, index }
}

/**
   * Parses the code string searching the end of the expression.
   * It skips braces, quoted strings, regexes, and ES6 template literals.
   *
   * @function exprExtr
   * @param   {string}  code  - Buffer to parse
   * @param   {number}  start - Position of the opening brace
   * @param   {[string,string]} bp - Brackets pair
   * @returns {Object} Expression's end (after the closing brace) or -1
   *                            if it is not an expr.
   */
export default function exprExtr(code, start, bp) {
  const [openingBraces, closingBraces] = bp
  const offset = start + openingBraces.length // skips the opening brace
  const stack = [] // expected closing braces ('`' for ES6 TL)
  const re = _regex(closingBraces)

  re.lastIndex = offset // begining of the expression

  let end
  let match

  while (match = re.exec(code)) { // eslint-disable-line
    const idx = match.index
    const str = match[0]
    end = re.lastIndex

    // end the iteration
    if (str === closingBraces && !stack.length) {
      return {
        text: code.slice(offset, idx),
        start,
        end
      }
    }

    const { char, index } = updateStack(stack, str[0], idx, code)
    // update the end value depending on the new index received
    end = index || end
    // update the regex last index
    re.lastIndex = char === $_ES6_BQ ? skipES6TL(code, end, stack) : end
  }

  if (stack.length) {
    panic(code, unclosedExpression, end)
  }
}