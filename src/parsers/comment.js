import flush from '../utils/flush-parser-store'
import panic from '../utils/panic'
import { unclosedComment } from '../messages'
import { TEXT, COMMENT } from '../node-types'
/**
 * Parses comments in long or short form
 * (any DOCTYPE & CDATA blocks are parsed as comments).
 *
 * @param {ParserStore} store  - Parser store
 * @param {string} data       - Buffer to parse
 * @param {number} start      - Position of the '<!' sequence
 * @private
 */
export function comment(store, data, start) {
  const pos = start + 2 // skip '<!'
  const str = data.substr(pos, 2) === '--' ? '-->' : '>'
  const end = data.indexOf(str, pos)
  if (end < 0) {
    panic(data, unclosedComment, start)
  }
  pushComment(store, start, end + str.length)

  return TEXT
}

/**
 * Stores a comment.
 *
 * @param {ParserStore}  store - Current parser store
 * @param {number}  start - Start position of the tag
 * @param {number}  end   - Ending position (last char of the tag)
 * @private
 */
export function pushComment(store, start, end) {
  flush(store)
  store.pos = end
  if (store.options.comments === true) {
    store.last = { type: COMMENT, start, end }
  }
}
