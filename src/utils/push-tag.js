import flush from './flush-parser-state'
import { TAG } from '../node-types'
import { isVoid, isCustom } from 'dom-nodes'

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
export default function pushTag(state, name, start, end) {
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