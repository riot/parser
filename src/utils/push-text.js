import {TEXT} from '../node-types'
import flush from './flush-parser-state'
import getChunk from './get-chunk'

/**
 * states text in the last text node, or creates a new one if needed.
 *
 * @param {ParserState}   state   - Current parser state
 * @param {number}  start   - Start position of the tag
 * @param {number}  end     - Ending position (last char of the tag)
 * @param {Object}  extra   - extra properties to add to the text node
 * @param {RawExpr[]} extra.expressions  - Found expressions
 * @param {string}    extra.unescape     - Brackets to unescape
 * @returns {undefined} - void function
 * @private
 */
export default function pushText(state, start, end, extra = {}) {
  const text = getChunk(state.data, start, end)
  const expressions = extra.expressions
  const unescape = extra.unescape

  let q = state.last
  state.pos = end

  if (q && q.type === TEXT) {
    q.text += text
    q.end = end
  } else {
    flush(state)
    state.last = q = { type: TEXT, text, start, end }
  }

  if (expressions && expressions.length) {
    q.expressions = (q.expressions || []).concat(expressions)
  }

  if (unescape) {
    q.unescape = unescape
  }

  return TEXT
}