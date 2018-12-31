import {COMMENT, TEXT} from '../node-types'
import flush from '../utils/flush-parser-state'
import panic from '../utils/panic'
import {unclosedComment} from '../messages'

/**
 * Parses comments in long or short form
 * (any DOCTYPE & CDATA blocks are parsed as comments).
 *
 * @param   {ParserState} state  - Parser state
 * @param   {string} data       - Buffer to parse
 * @param   {number} start      - Position of the '<!' sequence
 * @returns {number} node type id
 * @private
 */
export default function comment(state, data, start) {
  const pos = start + 2 // skip '<!'
  const str = data.substr(pos, 2) === '--' ? '-->' : '>'
  const end = data.indexOf(str, pos)
  if (end < 0) {
    panic(data, unclosedComment, start)
  }
  pushComment(state, start, end + str.length)

  return TEXT
}

/**
 * Parse a comment.
 *
 * @param   {ParserState}  state - Current parser state
 * @param   {number}  start - Start position of the tag
 * @param   {number}  end   - Ending position (last char of the tag)
 * @returns {undefined} void function
 * @private
 */
export function pushComment(state, start, end) {
  flush(state)
  state.pos = end
  if (state.options.comments === true) {
    state.last = { type: COMMENT, start, end }
  }
}
