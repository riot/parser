import escapeStr from './utils/escape-str'
import addToCollection from './utils/add-to-collection'
import exprExtr from './utils/expr-extr'
import panic from './utils/panic'
import execFromPos from './utils/exec-from-pos'
import treeBuilder from './tree-builder'
import * as MSG from './messages'
import curry from 'curri'
import { TEXT, ATTR, TAG, COMMENT, PRIVATE_JAVASCRIPT, PUBLIC_JAVASCRIPT } from './node-types'
import { TAG_2C, TAG_NAME, ATTR_START, RE_SCRYLE, EXPORT_DEFAULT } from './regex'
import { JAVASCRIPT_TAG, TEXTAREA_TAG } from './constants'

/**
 * Factory for the Parser class, exposing only the `parse` method.
 * The export adds the Parser class as property.
 *
 * @param   {Object}   options - User Options
 * @param   {Function} customBuilder - Tree builder factory
 * @returns {Function} Public Parser implementation.
 */
export default function parser(options, customBuilder) {
  const store = curry(createStore)(options, customBuilder || treeBuilder)
  return {
    parse: (data) => parse(store(data))
  }
}

/**
 * Create a new store object
 * @param   {object} userOptions - parser options
 * @param   {Function} customBuilder - Tree builder factory
 * @param   {string} data - data to parse
 * @returns {ParserStore}
 */
function createStore(userOptions, builder, data) {
  const options = Object.assign({
    brackets: ['{', '}']
  }, userOptions)

  return {
    options,
    regexCache: {},
    pos: 0,
    count: -1,
    root: null,
    last: null,
    scryle: null,
    builder: builder(data, options),
    data
  }
}

/**
 * It creates a raw output of pseudo-nodes with one of three different types,
 * all of them having a start/end position:
 *
 * - TAG     -- Opening or closing tags
 * - TEXT    -- Raw text
 * - COMMENT -- Comments
 *
 * @param   {ParserStore}  store - Current parser store
 * @returns {ParserResult} Result, contains data and output properties.
 */
function parse(store) {
  const { data } = store

  walk(store)
  flush(store)

  if (store.count) {
    panic(data, store.count > 0 ? MSG.unexpectedEndOfFile : MSG.rootTagNotFound, store.pos)
  }

  return {
    data,
    output: store.builder.get()
  }
}

/**
 * Parser walking recursive function
 * @param {ParserStore}  store - Current parser store
 * @param   {string} type - current parsing context
 */
function walk(store, type) {
  const { data } = store
  // extend the store adding the tree builder instance and the initial data
  const length = data.length

  // The "count" property is set to 1 when the first tag is found.
  // This becomes the root and precedent text or comments are discarded.
  // So, at the end of the parsing count must be zero.
  if (store.pos < length && store.count) {
    walk(store, eat(store, type))
  }
}

/**
 * Function to help iterating on the current parser store
 * @param {ParserStore}  store - Current parser store
 * @param   {string} type - current parsing context
 * @returns {string} parsing context
 */
function eat(store, type) {
  switch (type) {
  case TAG:
    return tag(store)
  case ATTR:
    return attr(store)
  default:
    return text(store)
  }
}

/**
 * Outputs the last parsed node. Can be used with a builder too.
 *
 * @param {ParserStore} store - Parsing store
 * @private
 */
function flush(store) {
  const last = store.last
  store.last = null
  if (last && store.root) {
    store.builder.push(last)
  }
}

/**
 * Stores a comment.
 *
 * @param {ParserStore}  store - Current parser store
 * @param {number}  start - Start position of the tag
 * @param {number}  end   - Ending position (last char of the tag)
 * @private
 */
function pushcomment(store, start, end) {
  flush(store)
  store.pos = end
  if (store.options.comments === true) {
    store.last = { type: COMMENT, start, end }
  }
}

/**
 * Stores text in the last text node, or creates a new one if needed.
 *
 * @param {ParserStore}   store   - Current parser store
 * @param {number}  start   - Start position of the tag
 * @param {number}  end     - Ending position (last char of the tag)
 * @param {object}  extra   - extra properties to add to the text node
 * @param {RawExpr[]} extra.expressions  - Found expressions
 * @param {string}    extra.unescape     - Brackets to unescape
 * @private
 */
function pushText(store, start, end, extra = {}) {
  const text = getChunk(store.data, start, end)
  const expressions = extra.expressions
  const unescape = extra.unescape

  let q = store.last
  store.pos = end

  if (q && q.type === TEXT) {
    q.text += text
    q.end = end
  } else {
    flush(store)
    store.last = q = { type: TEXT, text, start, end }
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
 * Pushes a new *tag* and set `last` to this, so any attributes
 * will be included on this and shifts the `end`.
 *
 * @param {ParserStore} store  - Current parser store
 * @param {string}  name      - Name of the node including any slash
 * @param {number}  start     - Start position of the tag
 * @param {number}  end       - Ending position (last char of the tag + 1)
 * @private
 */
function pushTag(store, name, start, end) {
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

/**
 * Parse the tag following a '<' character, or delegate to other parser
 * if an invalid tag name is found.
 *
 * @param   {ParserStore} store  - Parser store
 * @returns {number} New parser mode
 * @private
 */
function tag(store) {
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

/**
 * Parses comments in long or short form
 * (any DOCTYPE & CDATA blocks are parsed as comments).
 *
 * @param {ParserStore} store  - Parser store
 * @param {string} data       - Buffer to parse
 * @param {number} start      - Position of the '<!' sequence
 * @private
 */
function comment(store, data, start) {
  const pos = start + 2 // skip '<!'
  const str = data.substr(pos, 2) === '--' ? '-->' : '>'
  const end = data.indexOf(str, pos)
  if (end < 0) {
    panic(data, MSG.unclosedComment, start)
  }
  pushcomment(store, start, end + str.length)

  return TEXT
}

/**
 * The more complex parsing is for attributes as it can contain quoted or
 * unquoted values or expressions.
 *
 * @param   {ParserStore} store  - Parser store
 * @returns {number} New parser mode.
 * @private
 */
function attr(store) {
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
    attr.value = getChunk(data, valueStart, end)
    attr.valueStart = valueStart
    attr.end = quote ? ++end : end
  }

  return attr
}

/**
 * Parses regular text and script/style blocks ...scryle for short :-)
 * (the content of script and style is text as well)
 *
 * @param   {ParserStore} store - Parser store
 * @returns {number} New parser mode.
 * @private
 */
function text(store) {
  const { pos, data, scryle } = store

  switch (true) {
  case typeof scryle === 'string': {
    const name = scryle
    const re = RE_SCRYLE[name]
    const match = execFromPos(re, pos, data)

    if (!match) {
      panic(data, MSG.unclosedNamedBlock.replace('%1', name), pos - 1)
    }

    const start = match.index
    const end = re.lastIndex
    store.scryle = null // reset the script/style flag now
    // write the tag content, if any
    if (start > pos) {
      parseSpecialTagsContent(store, name, match)
    }
    // now the closing tag, either </script> or </style>
    pushTag(store, `/${name}`, start, end)
    break
  }
  case data[pos] === '<':
    store.pos++
    return TAG
  default:
    expr(store, null, '<', pos)
  }

  return TEXT
}

/**
 * Parse the text content depending on the name
 * @param   {ParserStore} store - Parser store
 * @param   {string} data  - Buffer to parse
 * @param   {string} name  - one of the tags matched by the RE_SCRYLE regex
 * @returns {array}  match - result of the regex matching the content of the parsed tag
 */
function parseSpecialTagsContent(store, name, match) {
  const { pos } = store
  const start = match.index

  switch (name) {
  case TEXTAREA_TAG:
    expr(store, null, match[0], pos)
    break
  case JAVASCRIPT_TAG:
    pushText(store, pos, start)
    pushJavascript(store, pos, start)
    break
  default:
    pushText(store, pos, start)
  }
}

/**
 * Create the javascript nodes
 * @param {ParserStore} store  - Current parser store
 * @param {number}  start   - Start position of the tag
 * @param {number}  end     - Ending position (last char of the tag)
 * @private
 */
function pushJavascript(store, start, end) {
  const code = getChunk(store.data, start, end)
  const push = store.builder.push.bind(store.builder)
  const match = EXPORT_DEFAULT.exec(code)
  store.pos = end

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
    panic(store.data, MSG.unableToParseExportDefault, start + publicJsIndex)
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

/**
 * Find the end of the attribute value or text node
 * Extract expressions.
 * Detect if value have escaped brackets.
 *
 * @param   {ParserStore} store  - Parser store
 * @param   {HasExpr} node      - Node if attr, info if text
 * @param   {string} endingChars - Ends the value or text
 * @param   {number} pos        - Starting position
 * @returns {number} Ending position
 * @private
 */
function expr(store, node, endingChars, start) {
  const re = b0re(store, endingChars)

  re.lastIndex = start // reset re position

  const { unescape, expressions, end } = parseExpressions(store, re)

  if (node) {
    if (unescape) {
      node.unescape = unescape
    }
    if (expressions.length) {
      node.expressions = expressions
    }
  } else {
    pushText(store, start, end, {expressions, unescape})
  }

  return end
}

/**
 * Parse a text chunk finding all the expressions in it
 * @param   {ParserStore} store  - Parser store
 * @param   {RegExp} re - regex to match the expressions contents
 * @returns {object} result containing the expression found, the string to unescape and the end position
 */
function parseExpressions(store, re) {
  const { data, options } = store
  const { brackets } = options
  const expressions = []
  let unescape, pos, match

  // Anything captured in $1 (closing quote or character) ends the loop...
  while ((match = re.exec(data)) && !match[1]) {
    // ...else, we have an opening bracket and maybe an expression.
    pos = match.index
    if (data[pos - 1] === '\\') {
      unescape = match[0] // it is an escaped opening brace
    } else {
      const tmpExpr = exprExtr(data, pos, brackets)
      if (tmpExpr) {
        expressions.push(tmpExpr)
        re.lastIndex = tmpExpr.end
      }
    }
  }

  // Even for text, the parser needs match a closing char
  if (!match) {
    panic(data, MSG.unexpectedEndOfFile, pos)
  }

  return {
    unescape,
    expressions,
    end: match.index
  }
}

/**
 * Get the code chunks from start and end range
 * @param   {string}  source  - source code
 * @param   {number}  start   - Start position of the chunk we want to extract
 * @param   {number}  end     - Ending position of the chunk we need
 * @returns {string}  chunk of code extracted from the source code received
 * @private
 */
function getChunk(source, start, end) {
  return source.slice(start, end)
}

/**
 * Creates a regex for the given string and the left bracket.
 * The string is captured in $1.
 *
 * @param   {ParserStore} store  - Parser store
 * @param   {string} str - String to search
 * @returns {RegExp} Resulting regex.
 * @private
 */
function b0re(store, str) {
  const { brackets } = store.options
  const re = store.regexCache[str]

  if (re) return re

  const b0 = escapeStr(brackets[0])
  // cache the regex extending the regexCache object
  Object.assign(store.regexCache, { [str]: new RegExp(`(${str})|${b0}`, 'g' ) })

  return store.regexCache[str]
}