import {TAG, TEXT} from '../node-types'
import {RE_SCRYLE} from '../regex'
import {TEXTAREA_TAG} from '../constants'
import execFromPos from '../utils/exec-from-pos'
import expr from './expression'
import panic from '../utils/panic'
import pushTag from '../utils/push-tag'
import pushText from '../utils/push-text'
import {unclosedNamedBlock} from '../messages'

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
 * @param   {string} name  - one of the tags matched by the RE_SCRYLE regex
 * @param   {Array}  match - result of the regex matching the content of the parsed tag
 * @returns {undefined} void function
 */
function parseSpecialTagsContent(state, name, match) {
  const { pos } = state
  const start = match.index

  if (name === TEXTAREA_TAG) {
    expr(state, null, match[0], pos)
  } else {
    pushText(state, pos, start)
  }
}