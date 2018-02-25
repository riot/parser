import getChunk from '../utils/get-chunk'
import execFromPos from '../utils/exec-from-pos'
import flush from '../utils/flush-parser-state'
import panic from '../utils/panic'
import { unclosedNamedBlock } from '../messages'
import { TEXT, TAG } from '../node-types'
import { RE_SCRYLE } from '../regex'
import { JAVASCRIPT_TAG, TEXTAREA_TAG } from '../constants'
import { expr } from './expression'
import { pushJavascript } from './javascript'
import { pushTag } from './tag'

/**
 * states text in the last text node, or creates a new one if needed.
 *
 * @param {ParserState}   state   - Current parser state
 * @param {number}  start   - Start position of the tag
 * @param {number}  end     - Ending position (last char of the tag)
 * @param {object}  extra   - extra properties to add to the text node
 * @param {RawExpr[]} extra.expressions  - Found expressions
 * @param {string}    extra.unescape     - Brackets to unescape
 * @private
 */
export function pushText(state, start, end, extra = {}) {
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


/**
 * Parses regular text and script/style blocks ...scryle for short :-)
 * (the content of script and style is text as well)
 *
 * @param   {ParserState} state - Parser state
 * @returns {number} New parser mode.
 * @private
 */
export function text(state) {
  const { pos, data, scryle } = state

  switch (true) {
  case typeof scryle === 'string': {
    const name = scryle
    const re = RE_SCRYLE[name]
    const match = execFromPos(re, pos, data)

    if (!match) {
      panic(data, unclosedNamedBlock.replace('%1', name), pos - 1)
    }

    const start = match.index
    const end = re.lastIndex
    state.scryle = null // reset the script/style flag now
    // write the tag content, if any
    if (start > pos) {
      parseSpecialTagsContent(state, name, match)
    }
    // now the closing tag, either </script> or </style>
    pushTag(state, `/${name}`, start, end)
    break
  }
  case data[pos] === '<':
    state.pos++
    return TAG
  default:
    expr(state, null, '<', pos)
  }

  return TEXT
}

/**
 * Parse the text content depending on the name
 * @param   {ParserState} state - Parser state
 * @param   {string} data  - Buffer to parse
 * @param   {string} name  - one of the tags matched by the RE_SCRYLE regex
 * @returns {array}  match - result of the regex matching the content of the parsed tag
 */
function parseSpecialTagsContent(state, name, match) {
  const { pos } = state
  const start = match.index

  switch (name) {
  case TEXTAREA_TAG:
    expr(state, null, match[0], pos)
    break
  case JAVASCRIPT_TAG:
    pushText(state, pos, start)
    pushJavascript(state, pos, start)
    break
  default:
    pushText(state, pos, start)
  }
}