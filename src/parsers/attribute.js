import execFromPos from '../utils/exec-from-pos'
import getChunk from '../utils/get-chunk'
import addToCollection from '../utils/add-to-collection'
import { TEXT, ATTR } from '../node-types'
import { ATTR_START } from '../regex'
import { expr } from './expression'
/**
 * The more complex parsing is for attributes as it can contain quoted or
 * unquoted values or expressions.
 *
 * @param   {ParserStore} store  - Parser store
 * @returns {number} New parser mode.
 * @private
 */
export function attr(store) {
  const { data, last, pos, root } = store
  const tag = last // the last (current) tag in the output
  const _CH = /\S/g // matches the first non-space char
  const ch = execFromPos(_CH, pos, data)

  switch (true) {
  case !ch:
    store.pos = data.length // reaching the end of the buffer with
    // NodeTypes.ATTR will generate error
    break
  case ch[0] === '>':
    // closing char found. If this is a self-closing tag with the name of the
    // Root tag, we need decrement the counter as we are changing mode.
    store.pos = tag.end = _CH.lastIndex
    if (tag.selfclose) {
      store.scryle = null // allow selfClosing script/style tags
      if (root && root.name === tag.name) {
        store.count-- // "pop" root tag
      }
    }
    return TEXT
  case ch[0] === '/':
    store.pos = _CH.lastIndex // maybe. delegate the validation
    tag.selfclose = true // the next loop
    break
  default:
    delete tag.selfclose // ensure unmark as selfclosing tag
    setAttribute(store, ch.index, tag)
  }

  return ATTR
}

/**
 * Parses an attribute and its expressions.
 *
 * @param   {ParserStore}  store  - Parser store
 * @param   {number} pos    - Starting position of the attribute
 * @param   {Object} tag    - Current parent tag
 * @private
 */
function setAttribute(store, pos, tag) {
  const { data } = store
  const re = ATTR_START // (\S[^>/=\s]*)(?:\s*=\s*([^>/])?)? g
  const start = re.lastIndex = pos // first non-whitespace
  const match = re.exec(data)

  if (!match) {
    return
  }

  let end = re.lastIndex
  const attr = parseAttribute(store, match, start, end)

  //assert(q && q.type === Mode.TAG, 'no previous tag for the attr!')
  // Pushes the attribute and shifts the `end` position of the tag (`last`).
  store.pos = tag.end = attr.end
  tag.attributes = addToCollection(tag.attributes, attr)
}

/**
 * Parse the attribute values normalising the quotes
 * @param   {ParserStore}  store  - Parser store
 * @param   {array} match - results of the attributes regex
 * @param   {number} start - attribute start position
 * @param   {number} end - attribute end position
 * @returns {object} attribute object
 */
function parseAttribute(store, match, start, end) {
  const { data } = store
  const attr = { name: match[1], value: '', start, end }

  let quote = match[2] // first letter of value or nothing

  // parse the whole value (if any) and get any expressions on it
  if (quote) {
    // Usually, the value's first char (`quote`) is a quote and the lastIndex
    // (`end`) is the start of the value.
    let valueStart = end
    // If it not, this is an unquoted value and we need adjust the start.
    if (quote !== '"' && quote !== "'") {
      quote = '' // first char of value is not a quote
      valueStart-- // adjust the starting position
    }

    end = expr(store, attr, quote || '[>/\\s]', valueStart)

    // adjust the bounds of the value and save its content
    Object.assign(attr, {
      value: getChunk(data, valueStart, end),
      valueStart,
      end: quote ? ++end : end
    })
  }

  return attr
}
