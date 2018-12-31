import {ATTR, TEXT} from '../node-types'
import {RE_SCRYLE, TAG_2C, TAG_NAME} from '../regex'
import comment from './comment'
import execFromPos from '../utils/exec-from-pos'
import pushTag from '../utils/push-tag'
import pushText from '../utils/push-text'

/**
 * Parse the tag following a '<' character, or delegate to other parser
 * if an invalid tag name is found.
 *
 * @param   {ParserState} state  - Parser state
 * @returns {number} New parser mode
 * @private
 */
export default function tag(state) {
  const { pos, data } = state // pos of the char following '<'
  const start = pos - 1 // pos of '<'
  const str = data.substr(pos, 2) // first two chars following '<'

  switch (true) {
  case str[0] === '!':
    return comment(state, data, start)
  case TAG_2C.test(str):
    return parseTag(state, start)
  default:
    return pushText(state, start, pos) // pushes the '<' as text
  }
}

function parseTag(state, start) {
  const { data, pos } = state
  const re = TAG_NAME // (\/?[^\s>/]+)\s*(>)? g
  const match = execFromPos(re, pos, data)
  const end = re.lastIndex
  const name = match[1].toLowerCase() // $1: tag name including any '/'
  // script/style block is parsed as another tag to extract attributes
  if (name in RE_SCRYLE) {
    state.scryle = name // used by parseText
  }

  pushTag(state, name, start, end)
  // only '>' can ends the tag here, the '/' is handled in parseAttribute
  if (!match[2]) {
    return ATTR
  }

  return TEXT
}