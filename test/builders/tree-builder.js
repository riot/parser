/**
 * Simple html builder...
 *
 * - Regular text:
 *   Whitespace compression, incluing text in `style` sections (Optional removal of whitespace-only text).
 * - Tags names:
 *   Removes extra whitespace and convert names to lowercase, except DOCTYPE that is uppercased.
 * - Self-closing tags:
 *   Removes the '/' and, if is not a void tag, adds the closing tag.
 * - Closing void tags:
 *   Raises error.
 * - Attributes:
 *   Removes extra whitespace, convert names to lowercase, removes empty values, and enclose values in double quotes.
 * - Comments:
 *   Convertion of short notation (`<! >`) to regular (`<!-- -->`).
 *
 * Throws on unclosed tags or closing tags without start tag.
 *
 * @class TreeBuilder
 */
const VOID_TAGS = require('./void-tags')
const T = require('../../')().nodeTypes

// Class htmlBuilder ======================================

function TreeBuilder(/*options*/) {
  this.build = this._build.bind(this)
}

Object.assign(TreeBuilder.prototype, {

  /**
   * Exposed as htmlBuilder.build
   *
   * @param   {object} input - Original code and array of pseudo-nodes
   * @returns {string} HTML output
   */
  _build(input) {

    const nodes = input.output
    const data = input.data
    const output = {
      tag: input.root,
      scripts: [],
      styles: [],
      data
    }
    this._stack = [this._last = output.tag]

    for (let pos = 1; pos < nodes.length; pos++) {
      const node = nodes[pos]

      if (node.type === T.TAG) {
        const name = node.name

        if (name[0] === '/') {
          // closing another tag, pop the stack
          this.closeTag(node, name)

        } else if (name === 'script' || name === 'style') {
          // is not a closing tag
          output[name + 's'].push(node)
          if (!node.selfclose && nodes[++pos].type === T.TEXT) {
            node.content = nodes[pos++]
          }

        } else {
          this.pushNode(node)
          if (!node.selfclose && !VOID_TAGS.test(name)) {
            this._stack.push(this._last = node)
          }
        }

      } else if (node.type === T.TEXT) {
        // not a container element...
        this.pushText(node, data)
      }
    }

    if (this._stack.length) {
      throw new Error('unexpected end of file')
    }

    return output
  },

  _re: {},
  _regex(c) {
    return this._re[c] || (this._re[c] = new RegExp(`\\${c}`, 'g'))
  },

  setExpr(node, text, offset) {
    const exprList = node.expressions
    const parts = []
    let pos = 0
    debugger
    for (let i = 0; i < exprList.length; i++) {
      const expr = exprList[i]
      const rep = node.replace
      let part = text.slice(pos, expr.start -= offset)
      if (rep) {
        part = part.replace(this._regex(rep), rep)
      }
      parts.push(part, expr)
      pos = expr.end -= offset
    }
    if (pos < text.length) parts.push(text.slice(pos))
    node.expressions = parts
  },

  pushText(node, data) {
    if (node.expressions) {
      this.setExpr(node, data.slice(node.start, node.end), node.start)
    }
    this.pushNode(node)
  },

  pushTag(node) {
    const attrList = node.attributes
    if (attrList) {
      for (let i = 0; i < attrList.length; i++) {
        const attr = attrList[i]
        if (attr.expressions) {
          this.setExpr(attr, attr.value, attr.valueStart)
          delete attr.value
        }
      }
    }
  },

  closeTag(node, name) {
    const last = this._last.name

    if (last !== name.slice(1)) {
      const err = last
        ? `expected "</${last}>" and instead saw "<${name}>".`
        : `unexpected closing tag "<${name}>".`

      throw new Error(err)
    }

    if (VOID_TAGS.test(last)) {
      throw new Error(`unexpected closing tag for void element "<${last}>".`)
    }

    this._stack.pop()
    this._last.end = node.end
    this._last = this._stack[this._stack.length - 1]
  },

  pushNode(node) {
    (this._last.nodes || (this._last.nodes = [])).push(node)
  },

})

module.exports = function treeBuilder(options) {
  return new TreeBuilder(options)
}
