import execFromPos from '../utils/exec-from-pos'
import flush from '../utils/flush-parser-store'
import { TEXT, ATTR, TAG } from '../node-types'
import { TAG_2C, TAG_NAME, RE_SCRYLE } from '../regex'
import { pushText } from './text'
import { comment } from './comment'

/**
 * Parse the tag following a '<' character, or delegate to other parser
 * if an invalid tag name is found.
 *
 * @param   {ParserStore} store  - Parser store
 * @returns {number} New parser mode
 * @private
 */
export function tag(store) {
  const { pos, data } = store // pos of the char following '<'
  const start = pos - 1 // pos of '<'
  const str = data.substr(pos, 2) // first two chars following '<'

  switch (true) {
  case str[0] === '!':
    return comment(store, data, start)
  case TAG_2C.test(str):
    return parseTag(store, start)
  default:
    return pushText(store, start, pos) // pushes the '<' as text
  }
}


/**
 * Pushes a new *tag* and set `last` to this, so any attributes
 * will be included on this and shifts the `end`.
 *
 * @param {ParserStore} store  - Current parser store
 * @param {string}  name      - Name of the node including any slash
 * @param {number}  start     - Start position of the tag
 * @param {number}  end       - Ending position (last char of the tag + 1)
 * @private
 */
export function pushTag(store, name, start, end) {
  const root = store.root
  const last = { type: TAG, name, start, end }
  store.pos = end
  if (root) {
    if (name === root.name) {
      store.count++
    } else if (name === root.close) {
      store.count--
    }
    flush(store)
  } else {
    // start with root (keep ref to output)
    store.root = { name: last.name, close: `/${name}` }
    store.count = 1
  }
  store.last = last
}

function parseTag(store, start) {
  const { data, pos } = store
  const re = TAG_NAME // (\/?[^\s>/]+)\s*(>)? g
  const match = execFromPos(re, pos, data)
  const end = re.lastIndex
  const name = match[1].toLowerCase() // $1: tag name including any '/'
  // script/style block is parsed as another tag to extract attributes
  if (name in RE_SCRYLE) {
    store.scryle = name // used by parseText
  }

  pushTag(store, name, start, end)
  // only '>' can ends the tag here, the '/' is handled in parseAttribute
  if (!match[2]) {
    return ATTR
  }

  return TEXT
}