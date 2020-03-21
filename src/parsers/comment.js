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
  const isLongComment = data.substr(pos, 2) === '--'
  const str = isLongComment ? '-->' : '>'
  const end = data.indexOf(str, pos)

  if (end < 0) {
    panic(data, unclosedComment, start)
  }

  pushComment(
    state,
    start,
    end + str.length,
    data.substring(start, end + str.length)
  )

  return TEXT
}

/**
 * Parse a comment.
 *
 * @param   {ParserState}  state - Current parser state
 * @param   {number}  start - Start position of the tag
 * @param   {number}  end   - Ending position (last char of the tag)
 * @param   {string}  text  - Comment content
 * @returns {undefined} void function
 * @private
 */
export function pushComment(state, start, end, text) {
  state.pos = end
  if (state.options.comments === true) {
    flush(state)
    state.last = {
      type: COMMENT,
      start,
      end,
      text
    }
  }
}
