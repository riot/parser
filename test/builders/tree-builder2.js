/**
 * Simple tree builder for the riot tag parser.
 *
 * The output has a root property and separate arrays for `html`, `css`,
 * and `js` tags.
 *
 * The root tag is not included in the `html` array.
 * Script tags marked with "defer" are included in `html` instead `js`.
 *
 * Throws on unclosed tags or closing tags without start tag.
 *
 * @class TreeBuilder
 */

const VOID_TAGS = require('./void-tags')
const T = require('../../')().nodeTypes

// Do not touch text content inside this tags
const RAW_TAGS = /^\/?(?:pre|textarea)$/

// Class htmlBuilder ======================================

function TreeBuilder() {
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

    const tags  = input.output
    const state = {
      data: input.data,
      options: this.options,
      last: { children: [] },
      js: { children: [] },
      css: { children: [] },
      stack: [],
    }
    debugger
    for (let pos = 0; pos < tags.length; pos++) {
      const node = tags[pos]

      if (node.type === T.TEXT) {
        this.pushText(state, node)

      } else if (node.type === T.TAG) {
        const name = node.name

        if (name[0] === '/') {
          this.closeTag(state, name)
        } else {
          this.openTag(state, node)
        }
      }
    }

    if (state.stack.length) {
      throw new Error('unexpected end of file')
    }

    const root = state.last.children[0]

    return {
      root,
      html: root.children,
      css: state.css.children,
      js: state.js.children
    }
  },

  closeTag(state, name) {
    const node = state.last
    const last = node.name

    if (last !== name.slice(1)) {
      const err = last
        ? `Expected "</${last}>" and instead saw "<${name}>".`
        : `Unexpected closing tag "<${name}>".`
      throw new Error(err)
    }

    state.last = state.stack.pop()

    if (!state.last) {
      throw new Error('No stack.')
    }
  },

  openTag(state, node) {
    const name = node.name

    let voidTags
    if (state.last.svg || name === 'svg') {
      node.svg = true
      voidTags = VOID_TAGS.svgTags
    } else {
      voidTags = VOID_TAGS.htmlTags
    }

    if (~voidTags.indexOf(name)) {
      node.void = true
    }

    if (state.last.raw || RAW_TAGS.test(name)) {
      node.raw = true
    }

    let last
    if (name === 'style') {
      last = state.css
    } else if (name === 'script' && !this.deferred(node)) {
      last = state.js
    } else {
      last = state.last
    }

    last.children.push(node)

    if (!node.void && !node.selfclose) {
      node.children = []
      state.stack.push(state.last)
      state.last = node
    }
  },

  pushText(state, node) {
    if (state.last.children) {
      state.last.children.push(node)
    }
  },

  deferred(node) {
    const attrs = node.attributes
    if (attrs && attrs.find(a => a.name === 'src')) {
      for (let i = 0; i < attrs.length; i++) {
        if (attrs[i].name === 'defer') {
          attrs.splice(i, 1)
          return true
        }
      }
    }
    return false
  }

})

module.exports = () => new TreeBuilder()
