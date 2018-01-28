import treeBuilder from './tree-builder'
import escapeStr from './escape-str'
import exprExtr from './expr-extr'
import formatError from './format-error'
import * as MSG from './messages'
import { TEXT, ATTR, TAG, COMMENT, PRIVATE_JAVASCRIPT, PUBLIC_JAVASCRIPT } from './node-types'

/**
 * Matches the start of valid tags names; used with the first 2 chars after the `'<'`.
 * @const
 * @private
 */
const TAG_2C = /^(?:\/[a-zA-Z]|[a-zA-Z][^\s>/]?)/
/**
 * Matches valid tags names AFTER the validation with `TAG_2C`.
 * $1: tag name including any `'/'`, $2: non self-closing brace (`>`) w/o attributes.
 * @const
 * @private
 */
const TAG_NAME = /(\/?[^\s>/]+)\s*(>)?/g
/**
 * Matches an attribute name-value pair (both can be empty).
 * $1: attribute name, $2: value including any quotes.
 * @const
 * @private
 */
const ATTR_START = /(\S[^>/=\s]*)(?:\s*=\s*([^>/])?)?/g
/**
 * Matches the closing tag of a `script` and `style` block.
 * Used by parseText fo find the end of the block.
 * @const
 * @private
 */
const RE_SCRYLE = {
  script: /<\/script\s*>/gi,
  style: /<\/style\s*>/gi,
  textarea: /<\/textarea\s*>/gi,
}

/**
 * Matches the beginning of an `export default {}` expression
 * @const
 * @private
 */
const EXPORT_DEFAULT = /export(?:\W)+default(?:\s+)?{/g

/**
 * Factory for the Parser class, exposing only the `parse` method.
 * The export adds the Parser class as property.
 *
 * @param   {Object}   options - User Options
 * @param   {Function} customBuilder - Tree builder factory
 * @returns {Function} Public Parser implementation.
 */
export default function parser(options, customBuilder) {
  const store = {
    options: Object.assign({
      brackets: ['{', '}']
    }, options)
  }

  return {
    parse: (data) => parse(data, store, customBuilder || treeBuilder)
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
 * @param   {string} data - HTML markup
 * @param   {ParserStore}  store - Current parser store
 * @param   {function}  builder - Tree builder factory function
 * @returns {ParserResult} Result, contains data and output properties.
 */
function parse(data, store, builder) {
  // extend the store adding the tree builder instance and the initial data
  Object.assign(store, {
    regexCache: {},
    pos: 0,
    count: -1,
    root: null,
    last: null,
    scryle: null,
    builder: builder(data, store.options),
    data
  })

  const length = data.length
  let type

  // The "count" property is set to 1 when the first tag is found.
  // This becomes the root and precedent text or comments are discarded.
  // So, at the end of the parsing count must be zero.
  while (store.pos < length && store.count) {
    switch (type) {
    case TAG:
      type = tag(store, data)
      break
    case ATTR:
      type = attr(store, data)
      break
    default:
      type = text(store, data)
    }
  }

  flush(store)

  if (store.count) {
    err(data, store.count > 0
      ? MSG.unexpectedEndOfFile : MSG.rootTagNotFound, store.pos)
  }

  return {
    data,
    output: store.builder.get()
  }
}

/**
 * Custom error handler can replace this method.
 * The `store` object includes the buffer (`data`)
 * The error position (`loc`) contains line (base 1) and col (base 0).
 *
 * @param {string} source   - Processing buffer
 * @param {string} message  - Error message
 * @param {number} pos    - Error position
 * @private
 */
function err(data, msg, pos) {
  const message = formatError(data, msg, pos)
  throw new Error(message)
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
 * @param {RawExpr[]} [expr]  - Found expressions
 * @param {string}  [rep]   - Brackets to unescape
 * @private
 */
function pushText(store, start, end, expr, rep) {
  const text = getChunk(store.data, start, end)
  let q = store.last
  store.pos = end

  if (q && q.type === TEXT) {
    q.text += text
    q.end = end
  } else {
    flush(store)
    store.last = q = { type: TEXT, text, start, end }
  }

  if (expr) {
    q.expressions = (q.expressions || []).concat(expr)
  }

  if (rep) {
    q.unescape = rep
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
function pushTag(store, name, start, end) {
  const root = store.root
  const last = { type: TAG, name, start, end }
  store.pos = end
  if (root) {
    if (name === root.name) {
      store.count++
    }
    else if (name === root.close) {
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
 * @param   {string} data       - Buffer to parse
 * @returns {number} New parser mode
 * @private
 */
function tag(store, data) {
  const pos = store.pos // pos of the char following '<'
  const start = pos - 1 // pos of '<'
  const str = data.substr(pos, 2) // first two chars following '<'

  if (str[0] === '!') {
    comment(store, data, start)
  } else if (TAG_2C.test(str)) {
    const re = TAG_NAME // (\/?[^\s>/]+)\s*(>)? g
    re.lastIndex = pos
    const match = re.exec(data)
    const end = re.lastIndex
    const name = match[1].toLowerCase() // $1: tag name including any '/'
    // script/style block is parsed as another tag to extract attributes
    if (name in RE_SCRYLE) {
      store.scryle = name // used by parseText
    }

    pushTag(store, name, start, end)
    // only '>' can ends the tag here, the '/' is handled in parseAttr
    if (!match[2]) {
      return ATTR
    }
  } else {
    pushText(store, start, pos) // pushes the '<' as text
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
    err(data, MSG.unclosedComment, start)
  }
  pushcomment(store, start, end + str.length)
}

/**
 * The more complex parsing is for attributes as it can contain quoted or
 * unquoted values or expressions.
 *
 * @param   {ParserStore} store  - Parser store
 * @param   {string} data       - Buffer to parse
 * @returns {number} New parser mode.
 * @private
 */
function attr(store, data) {
  const tag = store.last // the last (current) tag in the output
  const _CH = /\S/g // matches the first non-space char
  _CH.lastIndex = store.pos // first char of attribute's name
  const ch = _CH.exec(data)

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
      if (store.root && store.root.name === tag.name) {
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
    setAttr(store, data, ch.index, tag)
  }

  return ATTR
}

/**
 * Parses an attribute and its expressions.
 *
 * @param   {ParserStore}  store  - Parser store
 * @param   {string} data   - Whole buffer
 * @param   {number} pos    - Starting position of the attribute
 * @param   {Object} tag    - Current parent tag
 * @private
 */
function setAttr(store, data, pos, tag) {
  const re = ATTR_START // (\S[^>/=\s]*)(?:\s*=\s*([^>/])?)? g
  const start = re.lastIndex = pos // first non-whitespace
  const match = re.exec(data)

  if (!match) {
    return
  }

  let end = re.lastIndex
  let quote = match[2] // first letter of value or nothing
  const attr = { name: match[1], value: '', start, end }
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

    end = expr(store, data, attr, quote || '[>/\\s]', valueStart)
    // adjust the bounds of the value and save its content
    attr.value = getChunk(data, valueStart, end)
    attr.valueStart = valueStart
    attr.end = quote ? ++end : end
  }

  //assert(q && q.type === Mode.TAG, 'no previous tag for the attr!')
  // Pushes the attribute and shifts the `end` position of the tag (`last`).
  store.pos = tag.end = end;
  (tag.attributes || (tag.attributes = [])).push(attr)
}

/**
 * Parses regular text and script/style blocks ...scryle for short :-)
 * (the content of script and style is text as well)
 *
 * @param   {ParserStore} store - Parser store
 * @param   {string} data  - Buffer to parse
 * @returns {number} New parser mode.
 * @private
 */
function text(store, data) {
  const pos = store.pos // start of the text

  if (store.scryle) {
    const name = store.scryle
    const re = RE_SCRYLE[name]
    re.lastIndex = pos
    const match = re.exec(data)
    if (!match) {
      err(data, MSG.unclosedNamedBlock.replace('%1', name), pos - 1)
    }
    const start = match.index
    const end = re.lastIndex
    store.scryle = null // reset the script/style flag now
    // write the tag content, if any
    if (start > pos) {
      switch (name) {
      case 'textarea':
        expr(store, data, null, match[0], pos)
        break
      case 'script':
        pushText(store, pos, start)
        pushJavascript(store, pos, start)
        break
      default:
        pushText(store, pos, start)
      }
    }
    // now the closing tag, either </script> or </style>
    pushTag(store, `/${name}`, start, end)
  } else if (data[pos] === '<') {
    store.pos++
    return TAG
  } else {
    expr(store, data, null, '<', pos)
  }

  return TEXT
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
  if (!publicJs)
    err(store.data, MSG.unableToParseExportDefault, start + publicJsIndex)

  ;[
    createPrivateJsNode(code, start, 0, match.index),
    {
      type: PUBLIC_JAVASCRIPT,
      start: start + publicJsIndex,
      end: start + publicJsIndex + publicJs.end,
      code: publicJs.text
    },
    createPrivateJsNode(code, start, publicJsIndex + publicJs.end, code.length)
  ].forEach(push)
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
 * @param   {string} data       - Source code
 * @param   {HasExpr} node      - Node if attr, info if text
 * @param   {string} endingChars - Ends the value or text
 * @param   {number} pos        - Starting position
 * @returns {number} Ending position
 * @private
 */
function expr(store, data, node, endingChars, pos) {
  const start = pos
  const { brackets } = store.options
  const re = b0re(store, endingChars)

  let expr
  let unescape = ''
  let match

  re.lastIndex = pos

  // Anything captured in $1 (closing quote or character) ends the loop...
  while ((match = re.exec(data)) && !match[1]) {
    // ...else, we have an opening bracket and maybe an expression.
    pos = match.index
    if (data[pos - 1] === '\\') {
      unescape = match[0] // it is an escaped opening brace
    } else {
      const tmpExpr = exprExtr(data, pos, brackets)
      if (tmpExpr) {
        (expr || (expr = [])).push(tmpExpr)
        re.lastIndex = tmpExpr.end
      }
    }
  }

  // Even for text, the parser needs match a closing char
  if (!match) {
    err(data, MSG.unexpectedEndOfFile, pos)
  }
  const end = match.index
  if (node) {
    if (unescape) {
      node.unescape = unescape
    }
    if (expr) {
      node.expressions = expr
    }
  } else {
    pushText(store, start, end, expr, unescape)
  }

  return end
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