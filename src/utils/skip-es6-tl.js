import formatError from './format-error'
import {unclosedTemplateLiteral} from '../messages'
export const $_ES6_BQ = '`'

/**
 * Searches the next backquote that signals the end of the ES6 Template Literal
 * or the "${" sequence that starts a JS expression, skipping any escaped
 * character.
 *
 * @param   {string}    code  - Whole code
 * @param   {number}    pos   - The start position of the template
 * @param   {string[]}  stack - To save nested ES6 TL count
 * @returns {number}    The end of the string (-1 if not found)
 */
export default function skipES6TL(code, pos, stack) {
  // we are in the char following the backquote (`),
  // find the next unescaped backquote or the sequence "${"
  const re = /[`$\\]/g
  let c
  while (re.lastIndex = pos, re.exec(code)) {
    pos = re.lastIndex
    c = code[pos - 1]
    if (c === '`') {
      return pos
    }
    if (c === '$' && code[pos++] === '{') {
      stack.push($_ES6_BQ, '}')
      return pos
    }
    // else this is an escaped char
  }
  throw formatError(code, unclosedTemplateLiteral, pos)
}
