import execFromPos from '../utils/exec-from-pos'
import flush from '../utils/flush-parser-state'
import { TEXT, ATTR, TAG } from '../node-types'
import { isVoid, isCustom } from 'dom-nodes'
import { TAG_2C, TAG_NAME, RE_SCRYLE } from '../regex'
import { pushText } from './text'
import { comment } from './comment'

/**
 * Parse the tag following a '<' character, or delegate to other parser
 * if an invalid tag name is found.
 *
 * @param   {ParserState} state  - Parser state
 * @returns {number} New parser mode
 * @private
 */
export function tag(state) {
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


/**
 * Pushes a new *tag* and set `last` to this, so any attributes
 * will be included on this and shifts the `end`.
 *
 * @param {ParserState} state  - Current parser state
 * @param {string}  name      - Name of the node including any slash
 * @param {number}  start     - Start position of the tag
 * @param {number}  end       - Ending position (last char of the tag + 1)
 * @private
 */
export function pushTag(state, name, start, end) {
  const root = state.root
  const last = { type: TAG, name, start, end }

  if (isCustom(name) && !root) {
    last.isCustom = true
  }

  if (isVoid(name)) {
    last.isVoid = true
  }

  state.pos = end

  if (root) {
    if (name === root.name) {
      state.count++
    } else if (name === root.close) {
      state.count--
    }
    flush(state)
  } else {
    // start with root (keep ref to output)
    state.root = { name: last.name, close: `/${name}` }
    state.count = 1
  }
  state.last = last
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