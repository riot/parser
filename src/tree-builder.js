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
import {COMMENT, TAG, TEXT} from './node-types'
import {
  CSS_OUTPUT_NAME,
  IS_RAW,
  IS_SELF_CLOSING,
  IS_VOID,
  JAVASCRIPT_OUTPUT_NAME,
  JAVASCRIPT_TAG,
  STYLE_TAG,
  TEMPLATE_OUTPUT_NAME
} from './constants'
import {RAW_TAGS} from './regex'
import {duplicatedNamedTag} from './messages'
import panic from './utils/panic'

/**
 * Escape the carriage return and the line feed from a string
 * @param   {string} string - input string
 * @returns {string} output string escaped
 */
function escapeReturn(string) {
  return string
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
}

// check whether a tag has the 'src' attribute set like for example `<script src="">`
const hasSrcAttribute = node => (node.attributes || []).some(attr => attr.name === 'src')

/**
 * Escape double slashes in a string
 * @param   {string} string - input string
 * @returns {string} output string escaped
 */
function escapeSlashes(string) {
  return string.replace(/\\/g, '\\\\')
}

/**
 * Replace the multiple spaces with only one
 * @param   {string} string - input string
 * @returns {string} string without trailing spaces
 */
function cleanSpaces(string) {
  return string.replace(/\s+/g, ' ')
}

const TREE_BUILDER_STRUCT = Object.seal({
  get() {
    const store = this.store
    // The real root tag is in store.root.nodes[0]
    return {
      [TEMPLATE_OUTPUT_NAME]: store.root.nodes[0],
      [CSS_OUTPUT_NAME]: store[STYLE_TAG],
      [JAVASCRIPT_OUTPUT_NAME]: store[JAVASCRIPT_TAG]
    }
  },

  /**
  * Process the current tag or text.
  * @param {Object} node - Raw pseudo-node from the parser
  * @returns {undefined} void function
  */
  push(node) {
    const store = this.store

    switch (node.type) {
    case COMMENT:
      this.pushComment(store, node)
      break
    case TEXT:
      this.pushText(store, node)
      break
    case TAG: {
      const name = node.name
      const closingTagChar = '/'
      const [firstChar] = name

      if (firstChar === closingTagChar && !node.isVoid) {
        this.closeTag(store, node, name)
      } else if (firstChar !== closingTagChar) {
        this.openTag(store, node)
      }
      break
    }
    }
  },
  pushComment(store, node) {
    const parent = store.last

    parent.nodes.push(node)
  },
  closeTag(store, node) {
    const last = store.scryle || store.last

    last.end = node.end

    // update always the root node end position
    if (store.root.nodes[0]) store.root.nodes[0].end = node.end

    if (store.scryle) {
      store.scryle = null
    } else {
      store.last = store.stack.pop()
    }
  },

  openTag(store, node) {
    const name = node.name
    const attrs = node.attributes
    const isCoreTag = (JAVASCRIPT_TAG === name && !hasSrcAttribute(node) || name === STYLE_TAG)

    if (isCoreTag) {
      // Only accept one of each
      if (store[name]) {
        panic(this.store.data, duplicatedNamedTag.replace('%1', name), node.start)
      }

      store[name] = node
      store.scryle = store[name]
    } else {
      // store.last holds the last tag pushed in the stack and this are
      // non-void, non-empty tags, so we are sure the `lastTag` here
      // have a `nodes` property.
      const lastTag = store.last
      const newNode = node

      lastTag.nodes.push(newNode)

      if (lastTag[IS_RAW] || RAW_TAGS.test(name)) {
        node[IS_RAW] = true
      }

      if (!node[IS_SELF_CLOSING] && !node[IS_VOID]) {
        store.stack.push(lastTag)
        newNode.nodes = []
        store.last = newNode
      }
    }

    if (attrs) {
      this.attrs(attrs)
    }
  },
  attrs(attributes) {
    attributes.forEach(attr => {
      if (attr.value) {
        this.split(attr, attr.value, attr.valueStart, true)
      }
    })
  },
  pushText(store, node) {
    const text = node.text
    const empty = !/\S/.test(text)
    const scryle = store.scryle
    if (!scryle) {
      // store.last always have a nodes property
      const parent = store.last

      const pack = this.compact && !parent[IS_RAW]
      if (pack && empty) {
        return
      }
      this.split(node, text, node.start, pack)
      parent.nodes.push(node)
    } else if (!empty) {
      scryle.text = node
    }
  },
  split(node, source, start, pack) {
    const expressions = node.expressions
    const parts = []

    if (expressions) {
      let pos = 0

      expressions.forEach(expr => {
        const text = source.slice(pos, expr.start - start)
        const code = expr.text
        parts.push(this.sanitise(node, text, pack), escapeReturn(escapeSlashes(code).trim()))
        pos = expr.end - start
      })

      if (pos < node.end) {
        parts.push(this.sanitise(node, source.slice(pos), pack))
      }
    } else {
      parts[0] = this.sanitise(node, source, pack)
    }

    node.parts = parts.filter(p => p) // remove the empty strings
  },
  // unescape escaped brackets and split prefixes of expressions
  sanitise(node, text, pack) {
    let rep = node.unescape
    if (rep) {
      let idx = 0
      rep = `\\${rep}`
      while ((idx = text.indexOf(rep, idx)) !== -1) {
        text = text.substr(0, idx) + text.substr(idx + 1)
        idx++
      }
    }

    text = escapeSlashes(text)

    return pack ? cleanSpaces(text) : escapeReturn(text)
  }
})

export default function createTreeBuilder(data, options) {
  const root = {
    type: TAG,
    name: '',
    start: 0,
    end: 0,
    nodes: []
  }

  return Object.assign(Object.create(TREE_BUILDER_STRUCT), {
    compact: options.compact !== false,
    store: {
      last: root,
      stack: [],
      scryle: null,
      root,
      style: null,
      script: null,
      data
    }
  })
}
