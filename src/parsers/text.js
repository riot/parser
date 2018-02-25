import execFromPos from '../utils/exec-from-pos'
import panic from '../utils/panic'
import pushText from '../utils/push-text'
import pushTag from '../utils/push-tag'
import javascript from './javascript'
import expr from './expression'
import { unclosedNamedBlock } from '../messages'
import { TEXT, TAG } from '../node-types'
import { RE_SCRYLE } from '../regex'
import { JAVASCRIPT_TAG, TEXTAREA_TAG } from '../constants'

/**
 * Parses regular text and script/style blocks ...scryle for short :-)
 * (the content of script and style is text as well)
 *
 * @param   {ParserState} state - Parser state
 * @returns {number} New parser mode.
 * @private
 */
export default function text(state) {
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
    javascript(state, pos, start)
    break
  default:
    pushText(state, pos, start)
  }
}