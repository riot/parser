/**
 * Mini-parser for expressions.
 * This main pourpose of this module is to find the end of an expression
 * and return its text without the enclosing brackets.
 * Does not works with comments, but supports ES6 template strings.
 * @module parseExpr
 */

import skipRegex from './skip-regex'

/*
  If closing brace is }, ], ) we need find the open braces first,
  to discard others that belongs to JavaScript objects.
  Example of closing brackets:
  `}}`, `})`
*/

// Matches double quoted JS strings taking care about nested quotes
// and EOLs (escaped eols are Ok).
const S_DQ_STR = /"[^"\n\r\\]*(?:\\(?:\r\n?|[\S\s])[^"\n\r\\]*)*"/.source
const S_SQ_STR = S_DQ_STR.replace(/"/g, "'")


/**
 * Parses the code string searching the end of the expression.
 * @param {object} options - Parser parameters
 * @class ExprExtractor
 */
function ExprExtractor(options) {
  this._bp   = options.brackets             // brackets pair
  this._re   = RegExp(`${S_DQ_STR}|${S_SQ_STR}|${this._reChar(this._bp[1])}`, 'g')
  this.parse = this.parse.bind(this)
}


ExprExtractor.prototype = {

  /**
   * Parses the code string searching the end of the expression.
   * It skips braces, quoted strings, regexes, and ES6 template literals.
   *
   * @param   {string} code  - Buffer to parse
   * @param   {number} start - Position of the opening brace
   * @returns {number} Expression's end (after the closing brace) or -1 if it is not an expr.
   */
  parse(code, start) {  //eslint-disable-line complexity
    const bp = this._bp
    const re = this._re

    // Escaped brackets like "\{" must be converted by the builder to literal brackets.
    if (code[start - 1] === '\\') {
      return bp[0]
    }

    const closingStr = bp[1]
    const offset = start + bp[0].length
    const stack = []                        // braces (or 1, for ES6 TL)

    let match, ch

    re.lastIndex = offset                   // skip first brace

    while ((match = re.exec(code))) {
      const end = re.lastIndex
      let str = match[0]

      if (str === closingStr) {
        if (!stack.length) {
          return {
            text: code.slice(offset, match.index),
            start,
            end
          }
        }
        if (/[\])}]/.test(str[0])) {
          str = str[0]
          re.lastIndex = match.index + 1
        }
      }

      switch (str) {
        case '[':
        case '(':
        case '{':
          stack.push(str === '[' ? ']' : str === '(' ? ')' : '}')
          break

        case ')':
        case ']':
        case '}':
          ch = stack.pop()
          if (ch !== str) throw new Error(`Expected '${ch}' but got '${str}'`)
          break

        case '`':
          re.lastIndex = this.skipES6str(code, end, stack)
          break

        case '/':
          re.lastIndex = this.skipRegex(code, end)
          break

        default:  // quoted string, just skip
          // except inside ES6TL (like the second quote in `"${x}"`)
          if (stack[stack.length - 1] === 1) {
            re.lastIndex = match.index + 1  // only skip the first quote
          }
          break
      }
    }

    return null
  },

  /*
    Here we extract the regexes
  */
  skipRegex,

  /**
   * Simple ES6 Template Literal parser, it searches the next back-quote that
   * signals the end of the ES6TL or the `${` sequence that starts a JS expression,
   * skipping any escaped character.
   *
   * @param   {string} code  - Whole code
   * @param   {number} start - The start position of the template
   * @param   {number} stack - To save nested ES6 TL count
   * @returns {number}         The end of the string (-1 if not found)
   */
  skipES6str(code, start, stack) {

    // waiting the ES6TL end?
    if (stack.length && stack[stack.length - 1] === 1) {
      stack.pop()
      return start
    }

    // we are in the char following the back-tick (`),
    // find the next unescaped back-tick or the sequence "${"
    const re = /[`$\\]/g

    re.lastIndex = start
    while (re.exec(code)) {
      const end = re.lastIndex
      const c = code[end - 1]

      if (c === '`') {
        return end
      }
      if (c === '$' && code[end] === '{') {
        stack.push(1, '}')
        return end + 1
      }
      // else this is a scape char
    }

    throw new Error('Unclosed ES6 template')
  },

  // Makes an optimal regex that matches brackets and backquotes.
  _reChar(c) {
    let s
    if (c.length === 1) {
      if (/[\{}[\]()]/.test(c)) c = ''
      else if (c === '-') c = `\\${c}`
      s = '[`' + c + '/\\{}[\\]()]'
    } else {
      s = c.replace(/(?=[[^()\-*+?.$|])/g, '\\') + '|[`/\\{}[\\]()]'
    }
    return s
  }
}

export default function extractExpr(options) {
  return new ExprExtractor(options).parse
}
