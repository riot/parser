import getChunk from '../utils/get-chunk'
import panic from '../utils/panic'
import { unableToParseExportDefault } from '../messages'
import { PUBLIC_JAVASCRIPT, PRIVATE_JAVASCRIPT  } from '../node-types'
import { EXPORT_DEFAULT } from '../regex'
import exprExtr from '../utils/expr-extr'
/**
 * Create the javascript nodes
 * @param {ParserState} state  - Current parser state
 * @param {number}  start   - Start position of the tag
 * @param {number}  end     - Ending position (last char of the tag)
 * @private
 */
export function pushJavascript(state, start, end) {
  const code = getChunk(state.data, start, end)
  const push = state.builder.push.bind(state.builder)
  const match = EXPORT_DEFAULT.exec(code)
  state.pos = end

  // no export rules found
  // skip the nodes creation
  if (!match) return

  // find the export default index
  const publicJsIndex = EXPORT_DEFAULT.lastIndex
  // get the content of the export default tag
  // the exprExtr was meant to be used for expressions but it works
  // perfectly also in this case matching everything there is in { ... } block
  const publicJs = exprExtr(getChunk(code, publicJsIndex, end), 0, ['{', '}'])

  // dispatch syntax errors
  if (!publicJs) {
    panic(state.data, unableToParseExportDefault, start + publicJsIndex)
  }

  [
    createPrivateJsNode(code, start, 0, match.index),
    {
      type: PUBLIC_JAVASCRIPT,
      start: start + publicJsIndex,
      end: start + publicJsIndex + publicJs.end,
      code: publicJs.text
    },
    createPrivateJsNode(code, start, publicJsIndex + publicJs.end, code.length)
  ].filter(n => n.code).forEach(push)
}

/**
 * Create the private javascript chunks objects
 * @param   {string} code - code chunk
 * @param   {number} offset - offset from the top of the file
 * @param   {number} start - inner offset from the <script> tag
 * @param   {number} end - end offset
 * @returns {object} private js node
 * @private
 */
function createPrivateJsNode(code, offset, start, end) {
  return {
    type: PRIVATE_JAVASCRIPT,
    start: start + offset,
    end: end + offset,
    code: getChunk(code, start, end)
  }
}