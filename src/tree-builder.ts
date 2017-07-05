/*---------------------------------------------------------------------
 * Tree builder for the riot tag parser.
 *
 * The output has a root property and separate arrays for `html`, `css`,
 * and `js` tags.
 *
 * The root tag is included as first element in the `html` array.
 * Script tags marked with "defer" are included in `html` instead `js`.
 *
 * - Mark SVG tags
 * - Mark raw tags
 * - Mark void tags
 * - Split prefixes from expressions
 * - Unescape escaped brackets and escape EOLs and backslashes
 * - Compact whitespace (option `compact`) for non-raw tags
 * - Create an array `parts` for text nodes and attributes
 *
 * Throws on unclosed tags or closing tags without start tag.
 * Selfclosing and void tags has no nodes[] property.
 */

import formatError from './format-error'
import MSG from './messages'
import voidTags from './void-tags'

const SVG_NS = 'http://www.w3.org/2000/svg'

// Do not touch text content inside this tags
const RAW_TAGS = /^\/?(?:pre|textarea)$/

interface IHaveParts extends HasExpr {
  end: number
  parts?: any[]
}

interface NonVoidTag extends NodeTag {
  nodes: RiotNode[]
}

interface IState {
  data: string
  last: NonVoidTag
  stack: NonVoidTag[]
  root: NonVoidTag
  style: NodeScryle | null
  script: NodeScryle | null
  scryle: NodeScryle | null
}


// Class htmlBuilder ======================================

class TreeBuilder implements ITreeBuilder {

  private readonly compact: boolean
  private readonly prefixes: string
  private readonly state: IState

  // This get the option `whitespace` to preserve spaces
  // and the compact `option` to strip empty text nodes
  constructor(data: string, options: TreeBuilderOptions) {

    const root: NonVoidTag = {
      type: NodeTypes.TAG,
      name: '',
      start: 0,
      end: 0,
      nodes: [],
    }

    this.compact = options.compact !== false
    this.prefixes = '^?='
    this.state = {
      last: root,
      stack: [],
      scryle: null,
      root,
      style: null,
      script: null,
      data,
    }

  }


  public get() {

    const state = this.state

    // The real root tag is in state.root.nodes[0]
    return {
      html: state.root.nodes[0],
      css: state.style,
      js: state.script,
    }

  }


  /**
   * Process the current tag or text.
   *
   * @param {Object} node - Raw pseudo-node from the parser
   */
  public push(node: RawTag | RawText | RawCmnt) {
    const state = this.state

    if (node.type === NodeTypes.TEXT) {
      this.pushText(state, node)

    } else if (node.type === NodeTypes.TAG) {
      const name = node.name

      if (name[0] === '/') {
        this.closeTag(state, node, name)
      } else {
        this.openTag(state, node)
      }
    }
  }


  /**
   * Custom error handler can be implemented replacing this method.
   * The `state` object includes the buffer (`data`)
   * The error position (`loc`) contains line (base 1) and col (base 0).
   *
   * @param {string} msg   - Error message
   * @param {pos} [number] - Position of the error
   */
  private err(msg: string, pos?: number): never {
    const message = formatError(this.state.data, msg, pos)

    throw new Error(message)
  }


  private closeTag(state: IState, node: RawTag, name: string) {
    const last = state.scryle || state.last
    const expected = last.name

    if (expected !== name.slice(1)) {
      const msg = MSG.expectedAndInsteadSaw.replace('%1', expected).replace('%2', name)

      this.err(msg, last.start)
    }

    last.end = node.end

    if (state.scryle) {
      state.scryle = null

    } else {
      if (!state.stack[0]) {
        this.err('Stack is empty.', last.start)
      }
      state.last = state.stack.pop()!
    }
  }


  private openTag(state: IState, node: RawTag) {
    const name  = node.name
    const ns    = state.last.ns || (name === 'svg' ? SVG_NS : '')
    const attrs = node.attr

    if (attrs && !ns) {
      attrs.forEach(a => { a.name = a.name.toLowerCase() })
    }

    if (name === 'style' || name === 'script' && !this.deferred(node, attrs)) {

      // only one of both script and style tags
      if (state[name]) {
        this.err(MSG.duplicatedNamedTag.replace('%1', name), node.start)
      }
      state[name] = node as NodeScryle

      // support selfclosing script (w/o text content)
      if (!node.selfclose) {
        state.scryle = state[name]
      }

    } else {
      // state.last holds the last tag pushed in the stack and this are
      // non-void, non-empty tags, so we are sure the `lastTag` here
      // have a `nodes` property.
      const lastTag = state.last
      const newNode = node as NodeTag

      // lastTag have a nodes property
      lastTag.nodes.push(newNode)

      if (lastTag.raw || RAW_TAGS.test(name)) {
        newNode.raw = true
      }

      let voids
      if (ns) {
        newNode.ns = ns
        voids = voidTags.svg
      } else {
        voids = voidTags.html
      }

      if (~voids.indexOf(name)) {
        newNode.void = true

      } else if (!node.selfclose) {
        state.stack.push(lastTag)
        newNode.nodes = []
        state.last = newNode as NonVoidTag
      }
    }

    if (attrs) {
      this.attrs(attrs)
    }
  }


  private deferred(node: RawTag, attributes?: RawAttr[]) {

    if (attributes) {
      for (let i = 0; i < attributes.length; i++) {
        if (attributes[i].name === 'defer') {
          attributes.splice(i, 1)
          return true
        }
      }
    }

    return false
  }


  private attrs(attributes: RawAttr[]) {
    for (let i = 0; i < attributes.length; i++) {
      const attr = attributes[i]
      if (attr.value) {
        this.split(attr, attr.value, attr.valueStart!, true)
      }
    }
  }


  private pushText(state: IState, node: NodeText) {
    const text    = node.text
    const empty   = !/\S/.test(text)
    const scryle  = state.scryle

    if (!scryle) {
      // state.last always have a nodes property
      const parent = state.last
      const pack = this.compact && !parent.raw

      if (pack && empty) {
        return
      }
      this.split(node, text, node.start, pack)
      parent.nodes!.push(node)

    } else if (!empty) {
      scryle.text = node
    }
  }

  private split(node: IHaveParts, source: string, start: number, pack: boolean) {
    const expressions = node.expr
    const parts = []

    if (expressions) {
      let pos = 0

      for (let i = 0; i < expressions.length; i++) {
        const expr = expressions[i] as RawExpr
        const text = source.slice(pos, expr.start - start)
        let code = expr.text
        if (~this.prefixes.indexOf(code[0])) {
          expr.prefix = code[0]
          code = code.substr(1)
        }
        parts.push(
          this._tt(node, text, pack),
          code.replace(/\\/g, '\\\\').trim().replace(/\r/g, '\\r').replace(/\n/g, '\\n'))
        pos = expr.end - start
      }

      if ((pos += start) < node.end) {
        parts.push(this._tt(node, source.slice(pos), pack))
      }

    } else {
      parts[0] = this._tt(node, source, pack)
    }

    node.parts = parts
  }


  // unescape escaped brackets and split prefixes of expressions
  private _tt(node: IHaveParts, text: string, pack: boolean) {

    let rep = node.unescape as string
    if (rep) {
      let idx = 0
      rep = `\\${rep}`
      while (~(idx = text.indexOf(rep, idx))) {
        text = text.substr(0, idx) + text.substr(idx + 1)
        idx++
      }
    }

    text = text.replace(/\\/g, '\\\\')

    return pack ? text.replace(/\s+/, ' ') : text.replace(/\r/g, '\\r').replace(/\n/g, '\\n')
  }

}


export default function treeBuilder(data: string, options?: TreeBuilderOptions) {
  return new TreeBuilder(data, options || {}) as ITreeBuilder
}
