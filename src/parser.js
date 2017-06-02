/**
 * @module TagParser
 * @version v$_VERSION
 */

import assign from './utils/assign'
import extractExpr from './extract-expr'
//#if !_T
import $_T from './node-types'
//#endif

/**
 * Matches the start of valid tags names; used with the first 2 chars after the `'<'`.
 */
const TAG_2C = /^(?:\/[a-zA-Z>]|[a-zA-Z][^\s>/]?)/

/**
 * Matches valid tags names AFTER the validation with `TAG_2C`.
 * $1: tag name including any `'/'`, $2: non self-closing brace (`>`) w/o attributes.
 */
const TAG_NAME = /\/(>)|(\/?[^\s>/]+)\s*(>)?/g

/**
 * Matches an attribute name-value pair (both can be empty).
 * $1: attribute name, $2: value including any quotes.
 */
const ATTR_START = /(\S[^>/=\s]*)(?:\s*=\s*([^>/])?)?/g

/**
 * Matches the closing tag of a `script` and `style` block.
 * Used by parseText fo find the end of the block.
 */
const RE_SCRYLE = {
  script: /<\/script\s*>/gi,
  style: /<\/style\s*>/gi,
}


// The TagParser class ===============================================

function TagParser(options) {

  this.options = assign({
    comments: false,
    brackets: ['{', '}']
  }, options)

  this.extractExpr = extractExpr(this.options)
  this.parse = this._parse.bind(this)
  this._re = {}
}


// TagParser methods and properties ==================================

assign(TagParser.prototype, {

  nodeTypes: {
    TAG:      $_T.TAG,          // ELEMENT_NODE (tag)
    ATTR:     $_T.ATTR,         // ATTRIBUTE_NODE (attribute)
    TEXT:     $_T.TEXT,         // TEXT_NODE (#text)
    COMMENT:  $_T.COMMENT,      // COMMENT_NODE (#comment)
    EXPR:     $_T.EXPR          // DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC (riot)
  },

  /*
    It creates a raw output of pseudo-nodes with one of three different types,
    all of them having a start/end information.
    (`end` points to the character following the node).

    TAG     -- has `name` (ex. "div" or "/div"), `selfclose`, and `attributes`.
    TEXT    -- can have an `expr` property in addition to start/end.
    COMMENT -- has no props other than start/end.

    `TAG.attributes` is an array of objects with `name`, `value` and `expressions` props.

    `expressions` is an array of objects with start/end properties, relative to the
    whole buffer.
  */
  _parse(data) {
    const me = this

    // Creating the state in the closure and passing it as a parameter is more
    // efficient and allows to use the same parser instance asynchronously.
    const state = {
      pos: 0,                 // parsing position
      last: null,             // current open tag
      count: -1,              // count of nested tags with the name as root
      output: []              // array of pseudo-nodes
    }

    const length = data.length
    let type = $_T.TEXT

    // The "count" property is set to 1 when the first tag is found.
    // This becomes the root and precedent text or comments are discarded.
    // So, at the end of the parsing count must be zero.

    while (state.pos < length && state.count) {

      if (type === $_T.TEXT) {
        type = me.parseText(state, data)

      } else if (type === $_T.TAG) {
        type = me.parseTag(state, data)

      } else if (type === $_T.ATTR) {
        type = me.parseAttr(state, data)

      }
    }

    if (state.count < 0) {
      me._err(state, data, 'Root tag not found.')
    }

    if (state.count || type !== $_T.TEXT) {
      me._err(state, data, 'Unexpected end of file')
    }

    return { data, output: state.output }
  },

  /**
   * Custom error handler can be implemented replacing this method.
   * The `state` object includes the buffer (`data`)
   * The error position (`loc`) contains line (base 1) and col (base 0).
   *
   * @param   {object} state    - Current parser state
   * @param   {object} loc      - Line and column of the error
   * @param   {string} message  - Error message
   */
  error(state, loc, message) {
    message = `[${loc.line},${loc.col}]: ${message}`
    throw new Error(message)
  },

  /**
   * On error translates the current position to line, col and calls the
   * error method of the class.
   *
   * @param   {object} state - Current parser state
   * @param   {string} data  - Processing buffer
   * @param   {string} msg   - Error message
   * @param   {number} [pos] - Error position
   * @private
  */
  _err(state, data, msg, pos) {
    if (pos == null) pos = state.pos

    // count unix/mac/win eols
    const line = (data.slice(0, pos).match(/\r\n?|\n/g) || '').length + 1

    let col = 0
    while (--pos >= 0 && !/[\r\n]/.test(data[pos])) {
      ++col
    }

    state.data = data
    this.error(state, { line, col }, msg)
  },

  /**
   * Creates regex for the given string and the left bracket.
   *
   * @param   {string} str - String to add
   * @returns {RegExp} The resulting regex.
   * @private
   */
  _b0re(str) {
    let re = this._re[str]
    if (!re) {
      const b0 = this.options.brackets[0].replace(/(?=[[^()\-*+?.$|])/g, '\\')
      this._re[str] = re = new RegExp(`${str}|${b0}`, 'g')
    }
    return re
  },

  /**
   * @param   {number}      type  - Numeric node type
   * @param   {string|null} name  - The node name, if null the node has no `name` property
   * @param   {number}      start - Start pos. For tags, this will point to '<'
   * @param   {number}      end   - End of this node. In tags this will point to the char
   *                                following the '>', in text nodes to the char afther
   *                                the text, so this is mustly the `re.lastIndex` value
   * @returns {object} A new node.
   */
  newNode(type, name, start, end) {
    const node = { type, start, end }

    if (name) {
      node.name = name
    }

    return node
  },

  /**
   * Stores a comment.
   *
   * @param   {Object}  state - Current parser state
   * @param   {number}  start - Start position of the tag
   * @param   {number}  end   - Ending position (last char of the tag)
   */
  pushComment(state, start, end) {
    state.last = null
    state.pos  = end
    if (this.options.comments) {
      state.output.push(this.newNode($_T.COMMENT, null, start, end))
    }
  },

  /**
   * Stores text in the last text node, or creates a new one if needed.
   *
   * @param   {Object}  state  - Current parser state
   * @param   {number}  start  - Start position of the tag
   * @param   {number}  end    - Ending position (last char of the tag)
   * @param   {Array}   [expr] - Found expressions
   * @param   {string}  [rep]  - Escaped brackets to replace
   */
  pushText(state, start, end, expr, rep) {
    let q = state.last

    state.pos = end
    if (q && q.type === $_T.TEXT) {
      q.end = end
    } else {
      state.last = q = this.newNode($_T.TEXT, null, start, end)
      state.output.push(q)
    }

    if (expr && expr.length) {
      q.expressions = q.expressions ? q.expressions.concat(expr) : expr
    }

    if (rep) q.replace = rep
  },

  /**
   * Pushes a new *tag* and set `last` to this, so any attributes
   * will be included on this and shifts the `end`.
   *
   * @param   {object}  state - Current parser state
   * @param   {object}  type  - Like nodeType
   * @param   {object}  name  - Name of the node including any slash
   * @param   {number}  start - Start position of the tag
   * @param   {number}  end   - Ending position (last char of the tag + 1)
   */
  pushTag(state, type, name, start, end) {
    const root = state.root

    state.pos = end
    state.output.push(state.last = this.newNode(type, name, start, end))

    if (root) {
      if (name === root.name) {
        state.count++
      } else if (name === root.close) {
        state.count--
      }
    } else {
      // start with root (keep ref to output)
      state.output.splice(0, state.output.length - 1)
      state.root = { name: state.last.name, close: `/${name}` }
      state.count = 1
    }
  },

  /**
   * Pushes a new attribute and shifts the `end` position of the tag (`last`).
   *
   * @param   {Object}  state - Current parser state
   * @param   {Object}  attr  - Attribute
   */
  pushAttr(state, attr) {
    const q = state.last

    //assert(q && q.type === Mode.TAG, 'no previous tag for the attr!')
    state.pos = q.end = attr.end
    if (q.attributes) {
      q.attributes.push(attr)
    } else {
      q.attributes = [attr]
    }
  },

  /**
   * Parse the tag following a '<' character, or delegate to other parser
   * if an invalid tag name is found.
   *
   * @param   {object} state - Parser state
   * @param   {string} data  - Buffer to parse
   * @returns {number} New parser mode
   */
  parseTag(state, data) {
    const pos   = state.pos                 // pos of the char following '<'
    const start = pos - 1                   // pos of '<'
    const str   = data.substr(pos, 2)       // first two chars following '<'

    if (str[0] === '!') {                   // doctype, cdata, or comment
      return this.parseComment(state, data, start)
    }

    if (TAG_2C.test(str)) {                 // ^\/?[a-zA-Z]
      const re = TAG_NAME                   // (\/?(?:>|[^\s>/]+)\s*(>)?) g
      re.lastIndex = pos
      const match = re.exec(data)
      const end   = re.lastIndex
      const hack  = match[1]
      const name  = hack ? 'script' : match[2].toLowerCase()  // $1: tag name including any '/'

      // script/style block is parsed as another tag to extract attributes
      if (name === 'script' || name === 'style') {
        state.scryle = name         // used by parseText
        state.hack = hack && RegExp(`<${state.closeName}\\s*>`, 'i')
      }

      this.pushTag(state, $_T.TAG, name, start, end)

      // only '>' can ends the tag here, the '/' is handled in parseAttr
      if (!hack && match[3] !== '>') {      // $2: non self-closing brace w/o attr
        return $_T.ATTR
      }

    } else {
      this.pushText(state, start, pos)      // pushes the '<' as text
    }

    return $_T.TEXT
  },

  /**
   * Parses comments in long or short form
   * (any DOCTYPE & CDATA blocks are parsed as comments).
   *
   * @param   {object} state - Parser state
   * @param   {string} data  - Buffer to parse
   * @param   {number} start - Position of the '<!' sequence
   * @returns {number} New parser mode (always TEXT).
   */
  parseComment(state, data, start) {
    const pos = start + 2                   // skip '<!'
    const str = data.substr(pos, 2) === '--' ? '-->' : '>'
    const end = data.indexOf(str, pos)

    if (end < 0) {
      this._err(state, data, 'Unclosed comment', start)
    }

    this.pushComment(state, start, end + str.length)

    return $_T.TEXT
  },

  /**
   * The more complex parsing is for attributes as it can contain quoted or
   * unquoted values or expressions.
   *
   * @param   {object} state - Parser state
   * @param   {string} data  - Buffer to parse
   * @returns {number} New parser mode.
   */
  parseAttr(state, data) {
    const tag = state.last                  // the last (current) tag in the output
    const _CH = /\S/g                       // matches the first non-space char

    _CH.lastIndex = state.pos               // first char of attribute's name
    let match = _CH.exec(data)

    if (!match) {
      state.pos = data.length               // reaching the end of the buffer with
                                            // $_T.ATTR will generate error

    } else if (match[0] === '>') {
      // closing char found. If this is a self-closing tag with the name of the
      // Root tag, we need decrement the counter as we are changing mode.
      state.pos = tag.end = _CH.lastIndex
      if (tag.selfclose && state.root.name === tag.name) {
        state.count--                       // "pop" root tag
      }
      return $_T.TEXT

    } else if (match[0] === '/') {          // self closing tag?
      state.pos = _CH.lastIndex             // maybe. delegate the validation
      tag.selfclose = true                  // the next loop

    } else {
      delete tag.selfclose                  // ensure unmark as selfclosing tag
      // its a tag, go get the name and the first char of the value (mostly a quote)
      // we can find no value at all (even if there is an equal sign).
      const re    = ATTR_START              // (\S[^>/=\s]*)(?:\s*=\s*([^>/])?)? g
      const start = re.lastIndex = match.index  // first non-whitespace
      match       = re.exec(data)
      const end   = re.lastIndex
      const value = match[2] || ''          // first letter of value or nothing

      const attr  = { name: match[1].toLowerCase(), value, start, end }

      if (value) {
        // parse the whole value and get any expressions on it
        // (parseValue() will modify the `attr` object)
        this.parseValue(state, data, attr, value, end)
      }

      this.pushAttr(state, attr)
    }

    return $_T.ATTR
  },

  /**
   * Parses an attribute value for expressions.
   *
   * @param   {object} state - Parser state
   * @param   {string} data  - Whole buffer
   * @param   {object} attr  - Attribute as {name, value, start, end}
   * @param   {string} quote - First char of the attribute value
   * @param   {number} start - Position of the char following the `quote`
   */
  parseValue(state, data, attr, quote, start) {

    // Usually, the value's first char (`quote`) is a quote and the `start`
    // parameter is the stating position of the value.
    // If not, this is an unquoted value and we need adjust the starting position.
    if (quote !== '"' && quote !== "'") {
      quote = ''                            // first char of value is not a quote
      start--                               // adjust the starting position
    }

    // Get a regexp that matches the closing quote, ending char of unquoted values,
    // or the closing brace if we have an expression.
    const re = this._b0re(`(${quote || '[>/\\s]'})`)
    const expr = []
    let mm, tmp

    re.lastIndex = start
    while (1) {                             // eslint-disable-line
      mm = re.exec(data)
      if (!mm) {
        this._err(state, data, 'Unfinished attribute', start)
      }
      if (mm[1]) {
        break                               // the attribute ends
      }
      tmp = this.extractExpr(data, mm.index)
      if (tmp) {
        if (typeof tmp == 'string') {
          attr.replace = tmp                // it is an escaped opening brace
        } else {
          expr.push(tmp)
          re.lastIndex = tmp.end
        }
      }
    }

    // adjust the bounds of the value and save its content
    const end = mm.index
    attr.value = data.slice(start, end)
    attr.valueStart = start
    attr.end = quote ? end + 1 : end
    if (expr.length) {
      attr.expressions = expr
    }
  },

  /**
   * Parses regular text and script/style blocks ...scryle for short :-)
   * (the content of script and style is text as well)
   *
   * @param   {object} state - Parser state
   * @param   {string} data  - Buffer to parse
   * @returns {number} New parser mode.
   */
  parseText(state, data) {
    const me = this
    const pos = state.pos                  // start of the text

    if (state.scryle) {
      const name = state.scryle
      const re   = state.hack || RE_SCRYLE[name]

      re.lastIndex = pos
      const match = re.exec(data)
      if (!match) {
        me._err(state, data, `Unclosed "${name}" block`, pos - 1)
      }
      const start = match.index
      const end   = state.hack ? start : re.lastIndex
      state.hack = state.scryle = 0         // reset the script/style flag now

      // write the tag content, if any
      if (start > pos) {
        me.pushText(state, pos, start)
      }

      // now the closing tag, either </script> or </style>
      me.pushTag(state, $_T.TAG, `/${name}`, start, end)

    } else if (data[pos] === '<') {
      state.pos++
      return $_T.TAG

    } else {
      const re = me._b0re('<')

      re.lastIndex = pos
      let mm = re.exec(data)
      let expr
      let rep

      while (mm && mm[0] !== '<') {
        const tmp = me.extractExpr(data, mm.index)
        if (tmp) {
          if (typeof tmp == 'string') {
            rep = tmp
          } else {
            (expr || (expr = [])).push(tmp)
            re.lastIndex = tmp.end
          }
        }
        mm = re.exec(data)
      }

      // if no '<' found, all remaining is text
      const end = mm ? mm.index : data.length
      me.pushText(state, pos, end, expr, rep)
    }

    return $_T.TEXT
  }

})

export default function tagParser(options) {
  return new TagParser(options)
}
