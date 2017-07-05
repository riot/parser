/* ====================================================================
 * The Riot Tag Parser
 */

import escapeStr from './escape-str'
import exprExtr from './expr-extr'
import formatError from './format-error'

import MSG from './messages'

// --------------------------------------------------------------------
// Interfaces
//

interface RawRoot {
  name: string
  close: string
}

interface ParseState {
  pos: number
  last: ParsedNode | null
  count: number
  scryle: string | null
  builder: ITreeBuilder,
  data: string,
  root?: RawRoot
}


// --------------------------------------------------------------------
// Closure data and functions
//

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
const RE_SCRYLE: Hash<RegExp> = {
  script: /<\/script\s*>/gi,
  style: /<\/style\s*>/gi,
  textarea: /<\/textarea\s*>/gi,
}


// --------------------------------------------------------------------
// The TagParser class
//

/**
 * @class
 * @implements {IParser}
 */
class TagParser implements ITagParser {

  private readonly opts: ParserOptions
  private readonly bf: TreeBuilderFactory
  private readonly bp: [string, string]
  private readonly cm: boolean
  private readonly re: Hash<RegExp>

  /**
   * @param {Function} builderFactory - Factory function for the builder
   * @param {Object} options - User options
   */
  constructor(builderFactory: TreeBuilderFactory, options: ParserOptions) {
    this.opts = options

    this.bf = builderFactory
    this.bp = options.brackets
    this.cm = options.comments === true
    this.re = {}

  }

  // ------------------------------------------------------------------
  // Methods

  /**
   * It creates a raw output of pseudo-nodes with one of three different types,
   * all of them having a start/end position:
   *
   * - TAG     -- Opening or closing tags
   * - TEXT    -- Raw text
   * - COMMENT -- Comments
   *
   * @param   {string} data - HTML markup
   * @param   {number} pos  - Position where to start the parsing
   * @returns {ParserResult} Result, contains data and output properties.
   */
  public parse(data: string, pos: number): ParserResult {
    const me = this

    const builder = me.bf(data, me.opts)

    // Creating the state in the closure and passing it as a parameter is more
    // efficient and allows to use the same parser instance asynchronously.
    const state: ParseState = {
      pos: pos | 0,           // parsing position
      last: null,             // current open tag
      count: -1,              // count of nested tags with the name as root
      scryle: null,
      builder,
      data,
    }

    const length = data.length
    let type: NodeTypes = NodeTypes.TEXT

    // The "count" property is set to 1 when the first tag is found.
    // This becomes the root and precedent text or comments are discarded.
    // So, at the end of the parsing count must be zero.

    while (state.pos < length && state.count) {

      if (type === NodeTypes.TEXT) {
        type = me.text(state, data)

      } else if (type === NodeTypes.TAG) {
        type = me.tag(state, data)

      } else if (type === NodeTypes.ATTR) {
        type = me.attr(state, data)

      }
    }

    me.flush(state)

    if (state.count) {
      me.err(data, state.count > 0
        ? MSG.unexpectedEndOfFile : MSG.rootTagNotFound, state.pos)
    }

    return { data, output: builder.get() }
  }


  /**
   * Custom error handler can replace this method.
   * The `state` object includes the buffer (`data`)
   * The error position (`loc`) contains line (base 1) and col (base 0).
   *
   * @param {string} source   - Processing buffer
   * @param {string} message  - Error message
   * @param {number} pos    - Error position
   * @private
   */
  private err(data: string, msg: string, pos?: number): never {
    const message = formatError(data, msg, pos)

    throw new Error(message)
  }


  /**
   * Outputs the last parsed node. Can be used with a builder too.
   *
   * @param {ParseState} state - Parsing state
   * @private
   */
  private flush(state: ParseState) {
    const last = state.last

    state.last = null
    if (last && state.root) {
      state.builder.push(last)
    }
  }


  /**
   * Stores a comment.
   *
   * @param {ParseState}  state - Current parser state
   * @param {number}  start - Start position of the tag
   * @param {number}  end   - Ending position (last char of the tag)
   * @private
   */
  private pushCmnt(state: ParseState, start: number, end: number) {

    this.flush(state)

    state.pos = end
    if (this.cm === true) {
      state.last = { type: NodeTypes.COMMENT, start, end }
    }
  }


  /**
   * Stores text in the last text node, or creates a new one if needed.
   *
   * @param {ParseState}   state   - Current parser state
   * @param {number}  start   - Start position of the tag
   * @param {number}  end     - Ending position (last char of the tag)
   * @param {RawExpr[]} [expr]  - Found expressions
   * @param {string}  [rep]   - Brackets to unescape
   * @private
   */
  private pushText(state: ParseState, start: number, end: number, expr?: RawExpr[], rep?: string) {

    const text = state.data.slice(start, end)
    let q = state.last as RawText

    state.pos = end

    if (q && q.type === NodeTypes.TEXT) {
      q.text += text
      q.end = end
    } else {
      this.flush(state)
      state.last = q = { type: NodeTypes.TEXT, text, start, end }
    }

    if (expr) {
      q.expr = (q.expr || []).concat(expr)
    }

    if (rep) {
      q.unescape = rep
    }
  }

  /**
   * Pushes a new *tag* and set `last` to this, so any attributes
   * will be included on this and shifts the `end`.
   *
   * @param {ParseState} state  - Current parser state
   * @param {string}  name      - Name of the node including any slash
   * @param {number}  start     - Start position of the tag
   * @param {number}  end       - Ending position (last char of the tag + 1)
   * @private
   */
  private pushTag(state: ParseState, name: string, start: number, end: number) {

    const root = state.root
    const last = { type: NodeTypes.TAG, name, start, end } as RawTag

    state.pos = end

    if (root) {
      if (name === root.name) {
        state.count++
      } else if (name === root.close) {
        state.count--
      }
      this.flush(state)

    } else {
      // start with root (keep ref to output)
      state.root = { name: last.name, close: `/${name}` }
      state.count = 1
    }

    state.last = last
  }

  /**
   * Parse the tag following a '<' character, or delegate to other parser
   * if an invalid tag name is found.
   *
   * @param   {ParseState} state  - Parser state
   * @param   {string} data       - Buffer to parse
   * @returns {number} New parser mode
   * @private
   */
  private tag(state: ParseState, data: string) {
    const pos   = state.pos                 // pos of the char following '<'
    const start = pos - 1                   // pos of '<'
    const str   = data.substr(pos, 2)       // first two chars following '<'

    if (str[0] === '!') {                   // doctype, cdata, or comment
      this.cmnt(state, data, start)

    } else if (TAG_2C.test(str)) {          // ^(?:\/[a-zA-Z]|[a-zA-Z][^\s>/]?)
      const re = TAG_NAME                   // (\/?[^\s>/]+)\s*(>)? g
      re.lastIndex = pos
      const match = re.exec(data) as RegExpExecArray
      const end   = re.lastIndex
      const name  = match[1].toLowerCase()  // $1: tag name including any '/'

      // script/style block is parsed as another tag to extract attributes
      if (name in RE_SCRYLE) {
        state.scryle = name                 // used by parseText
      }

      this.pushTag(state, name, start, end)

      // only '>' can ends the tag here, the '/' is handled in parseAttr
      if (!match[2]) {                      // $2: non self-closing brace w/o attr
        return NodeTypes.ATTR
      }

    } else {
      this.pushText(state, start, pos)      // pushes the '<' as text
    }

    return NodeTypes.TEXT
  }

  /**
   * Parses comments in long or short form
   * (any DOCTYPE & CDATA blocks are parsed as comments).
   *
   * @param {ParseState} state  - Parser state
   * @param {string} data       - Buffer to parse
   * @param {number} start      - Position of the '<!' sequence
   * @private
   */
  private cmnt(state: ParseState, data: string, start: number) {
    const pos = start + 2                   // skip '<!'
    const str = data.substr(pos, 2) === '--' ? '-->' : '>'
    const end = data.indexOf(str, pos)

    if (end < 0) {
      this.err(data, MSG.unclosedComment, start)
    }

    this.pushCmnt(state, start, end + str.length)
  }

  /**
   * The more complex parsing is for attributes as it can contain quoted or
   * unquoted values or expressions.
   *
   * @param   {ParseState} state  - Parser state
   * @param   {string} data       - Buffer to parse
   * @returns {number} New parser mode.
   * @private
   */
  private attr(state: ParseState, data: string) {

    const tag = state.last as RawTag      // the last (current) tag in the output
    const _CH = /\S/g                       // matches the first non-space char

    _CH.lastIndex = state.pos               // first char of attribute's name
    const ch = _CH.exec(data)

    if (!ch) {
      state.pos = data.length               // reaching the end of the buffer with
                                            // NodeTypes.ATTR will generate error

    } else if (ch[0] === '>') {
      // closing char found. If this is a self-closing tag with the name of the
      // Root tag, we need decrement the counter as we are changing mode.
      state.pos = tag.end = _CH.lastIndex

      if (tag.selfclose) {
        state.scryle = null                 // allow selfClosing script/style tags

        if (state.root && state.root.name === tag.name) {
          state.count--                     // "pop" root tag
        }
      }

      return NodeTypes.TEXT

    } else if (ch[0] === '/') {             // self closing tag?
      state.pos = _CH.lastIndex             // maybe. delegate the validation
      tag.selfclose = true                  // the next loop

    } else {
      delete tag.selfclose                  // ensure unmark as selfclosing tag
      this.setAttr(state, data, ch.index, tag)
    }

    return NodeTypes.ATTR
  }

  /**
   * Parses an attribute and its expressions.
   *
   * @param   {ParseState}  state  - Parser state
   * @param   {string} data   - Whole buffer
   * @param   {number} pos    - Starting position of the attribute
   * @param   {Object} tag    - Current parent tag
   * @private
   */
  private setAttr(state: ParseState, data: string, pos: number, tag: RawTag) {

    const re    = ATTR_START                // (\S[^>/=\s]*)(?:\s*=\s*([^>/])?)? g
    const start = re.lastIndex = pos        // first non-whitespace
    const match = re.exec(data)

    if (!match) {
      return
    }

    let end     = re.lastIndex
    let quote   = match[2]                  // first letter of value or nothing

    const attr: RawAttr = { name: match[1], value: '', start, end }

    // parse the whole value (if any) and get any expressions on it
    if (quote) {
      // Usually, the value's first char (`quote`) is a quote and the lastIndex
      // (`end`) is the start of the value.
      let valueStart = end

      // If it not, this is an unquoted value and we need adjust the start.
      if (quote !== '"' && quote !== "'") {
        quote = ''                          // first char of value is not a quote
        valueStart--                        // adjust the starting position
      }

      end = this.expr(state, data, attr, quote || '[>/\\s]', valueStart)

      // adjust the bounds of the value and save its content
      attr.value = data.slice(valueStart, end)
      attr.valueStart = valueStart
      attr.end = quote ? ++end : end
    }

    //assert(q && q.type === Mode.TAG, 'no previous tag for the attr!')
    // Pushes the attribute and shifts the `end` position of the tag (`last`).
    state.pos = tag.end = end

    // tslint:disable-next-line:align whitespace
    ;(tag.attr || (tag.attr = [])).push(attr)
  }

  /**
   * Parses regular text and script/style blocks ...scryle for short :-)
   * (the content of script and style is text as well)
   *
   * @param   {ParseState} state - Parser state
   * @param   {string} data  - Buffer to parse
   * @returns {number} New parser mode.
   * @private
   */
  private text(state: ParseState, data: string) {
    const me = this
    const pos = state.pos                  // start of the text

    if (state.scryle) {
      const name = state.scryle
      const re   = RE_SCRYLE[name]

      re.lastIndex = pos
      const match = re.exec(data)
      if (!match) {
        me.err(data, MSG.unclosedNamedBlock.replace('%1', name), pos - 1)
      }
      const start = match!.index
      const end   = re.lastIndex

      state.scryle = null             // reset the script/style flag now

      // write the tag content, if any
      if (start > pos) {
        if (name === 'textarea') {
          this.expr(state, data, null, match![0], pos)
        } else {
          me.pushText(state, pos, start)
        }
      }

      // now the closing tag, either </script> or </style>
      me.pushTag(state, `/${name}`, start, end)

    } else if (data[pos] === '<') {
      state.pos++

      return NodeTypes.TAG

    } else {
      this.expr(state, data, null, '<', pos)
    }

    return NodeTypes.TEXT
  }

  /**
   * Find the end of the attribute value or text node
   * Extract expressions.
   * Detect if value have escaped brackets.
   *
   * @param   {ParseState} state  - Parser state
   * @param   {string} data       - Source code
   * @param   {HasExpr} node      - Node if attr, info if text
   * @param   {string} endingChars - Ends the value or text
   * @param   {number} pos        - Starting position
   * @returns {number} Ending position
   * @private
   */
  private expr(state: ParseState, data: string, node: HasExpr | null, endingChars: string, pos: number) {
    const me = this
    const start = pos

    let expr: RawExpr[] | undefined
    let unescape = ''

    const re = me.b0re(endingChars)
    let match
    re.lastIndex = pos

    // Anything captured in $1 (closing quote or character) ends the loop...
    while ((match = re.exec(data) as RegExpExecArray) && !match[1]) {

      // ...else, we have an opening bracket and maybe an expression.
      pos = match.index

      if (data[pos - 1] === '\\') {
        unescape = match[0]                // it is an escaped opening brace

      } else {
        const tmpExpr = exprExtr(data, pos, me.bp)
        if (tmpExpr) {
          (expr || (expr = [])).push(tmpExpr)
          re.lastIndex = tmpExpr.end
        }
      }
    }

    // Even for text, the parser needs match a closing char
    if (!match) {
      me.err(data, MSG.unexpectedEndOfFile, pos)
    }

    const end = match.index

    if (node) {
      if (unescape) {
        node.unescape = unescape
      }
      if (expr) {
        node.expr = expr
      }
    } else {
      me.pushText(state, start, end, expr, unescape)
    }

    return end
  }

  /**
   * Creates a regex for the given string and the left bracket.
   * The string is captured in $1.
   *
   * @param   {string} str - String to search
   * @returns {RegExp} Resulting regex.
   * @private
   */
  private b0re(str: string) {
    let re = this.re[str]

    if (!re) {
      const b0 = escapeStr(this.bp[0])
      this.re[str] = re = new RegExp(`(${str})|${b0}`, 'g')
    }

    return re
  }

}

export default TagParser
