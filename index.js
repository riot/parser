(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.parser = {})));
}(this, (function (exports) { 'use strict';

function formatError (data, message, pos) {
  if (!pos) {
    pos = data.length;
  }
  // count unix/mac/win eols
  const line = (data.slice(0, pos).match(/\r\n?|\n/g) || '').length + 1;
  let col = 0;
  while (--pos >= 0 && !/[\r\n]/.test(data[pos])) {
    ++col;
  }
  return `[${line},${col}]: ${message}`
}

const rootTagNotFound = 'Root tag not found.';
const unexpectedEndOfFile = 'Unexpected end of file.';

const unclosedComment = 'Unclosed comment.';
const unclosedNamedBlock = 'Unclosed "%1" block.';
const duplicatedNamedTag = 'Duplicate tag "<%1>".';

var voidTags = {
  /**
   * HTML void elements that cannot be auto-closed and shouldn't contain child nodes.
   *
   * basefont, bgsound, command, frame, isindex, nextid, nobr are not html5 elements.
   *
   * @const {Array.<string>}
   * @see   {@link http://www.w3.org/TR/html-markup/syntax.html#syntax-elements}
   * @see   {@link http://www.w3.org/TR/html5/syntax.html#void-elements}
   */
  html: [
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'keygen',
    'link',
    'menuitem',
    'meta',
    'param',
    'source',
    'track',
    'wbr'
  ],
  /**
   * SVG void elements that cannot be auto-closed and shouldn't contain child nodes.
   *
   * @const {Array.<string>}
   */
  svg: [
    'circle',
    'ellipse',
    'line',
    'path',
    'polygon',
    'polyline',
    'rect',
    'stop',
    'use'
  ]
}

/**
 * Not all the types are handled in this module.
 *
 * @enum {number}
 * @readonly
 */
const TAG = 1; /* TAG */
const ATTR = 2; /* ATTR */
const TEXT = 3; /* TEXT */
const CDATA = 4; /* CDATA */
const COMMENT = 8; /* COMMENT */
const DOCUMENT = 9; /* DOCUMENT */
const DOCTYPE = 10; /* DOCTYPE */
const DOCUMENT_FRAGMENT = 11; /* DOCUMENT_FRAGMENT */

// Javascript logic nodes
//
const PRIVATE_JAVASCRIPT = 20; /* Javascript private code */
const PUBLIC_JAVASCRIPT = 21; /* Javascript public methods */



var _nodeTypes = Object.freeze({
	TAG: TAG,
	ATTR: ATTR,
	TEXT: TEXT,
	CDATA: CDATA,
	COMMENT: COMMENT,
	DOCUMENT: DOCUMENT,
	DOCTYPE: DOCTYPE,
	DOCUMENT_FRAGMENT: DOCUMENT_FRAGMENT,
	PRIVATE_JAVASCRIPT: PRIVATE_JAVASCRIPT,
	PUBLIC_JAVASCRIPT: PUBLIC_JAVASCRIPT
});

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
// TODO: clean up this file

const SVG_NS = 'http://www.w3.org/2000/svg';
// Do not touch text content inside this tags
const RAW_TAGS = /^\/?(?:pre|textarea)$/;

const JAVASCRIPT_OUTPUT_NAME = 'javascript';
const CSS_OUTPUT_NAME = 'css';
const TEMPLATE_OUTPUT_NAME = 'template';

const JAVASCRIPT_TAG = 'script';
const STYLE_TAG = 'style';

/**
 * Custom error handler can be implemented replacing this method.
 * The `state` object includes the buffer (`data`)
 * The error position (`loc`) contains line (base 1) and col (base 0).
 *
 * @param {string} msg   - Error message
 * @param {pos} [number] - Position of the error
 */
function err$1(msg, pos, data) {
  const message = formatError(data, msg, pos);
  throw new Error(message)
}

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
    const state = this.state;
    // The real root tag is in state.root.nodes[0]
    return {
      [TEMPLATE_OUTPUT_NAME]: state.root.nodes[0],
      [CSS_OUTPUT_NAME]: state.style,
      [JAVASCRIPT_OUTPUT_NAME]: state.script,
    }
  },
 /**
  * Process the current tag or text.
  *
  * @param {Object} node - Raw pseudo-node from the parser
  */
  push(node) {
    const state = this.state;
    if (node.type === TEXT) {
      this.pushText(state, node);
    } else if (node.type === TAG) {
      const name = node.name;
      if (name[0] === '/') {
        this.closeTag(state, node, name);
      } else {
        this.openTag(state, node);
      }
    } else if ([PRIVATE_JAVASCRIPT, PUBLIC_JAVASCRIPT].includes(node.type)) {
      (state[JAVASCRIPT_TAG].nodes = state[JAVASCRIPT_TAG].nodes || []).push(node);
    }
  },
  closeTag(state, node, name) { // eslint-disable-line
    const last = state.scryle || state.last;

    last.end = node.end;

    if (state.scryle) {
      state.scryle = null;
    } else {
      if (!state.stack[0]) {
        err$1('Stack is empty.', last.start, this.state.data);
      }
      state.last = state.stack.pop();
    }
  },

  openTag(state, node) {
    const name = node.name;
    const ns = state.last.ns || (name === 'svg' ? SVG_NS : '');
    const attrs = node.attr;
    if (attrs && !ns) {
      attrs.forEach(a => { a.name = a.name.toLowerCase(); });
    }
    if ([JAVASCRIPT_TAG, STYLE_TAG].includes(name) && !this.deferred(node, attrs)) {
      // Only accept one of each
      if (state[name]) {
        err$1(duplicatedNamedTag.replace('%1', name), node.start, this.state.data);
      }
      state[name] = node;
      // support selfclosing script (w/o text content)
      if (!node.selfclose) {
        state.scryle = state[name];
      }
    } else {
      // state.last holds the last tag pushed in the stack and this are
      // non-void, non-empty tags, so we are sure the `lastTag` here
      // have a `nodes` property.
      const lastTag = state.last;
      const newNode = node;
      lastTag.nodes.push(newNode);
      if (lastTag.raw || RAW_TAGS.test(name)) {
        newNode.raw = true;
      }
      let voids;
      if (ns) {
        newNode.ns = ns;
        voids = voidTags.svg;
      }
      else {
        voids = voidTags.html;
      }
      if (voids.indexOf(name) !== -1) {
        newNode.void = true;
      }
      else if (!node.selfclose) {
        state.stack.push(lastTag);
        newNode.nodes = [];
        state.last = newNode;
      }
    }
    if (attrs) {
      this.attrs(attrs);
    }
  },
  deferred(node, attributes) {
    if (attributes) {
      for (let i = 0; i < attributes.length; i++) {
        if (attributes[i].name === 'defer') {
          attributes.splice(i, 1);
          return true
        }
      }
    }
    return false
  },
  attrs(attributes) {
    for (let i = 0; i < attributes.length; i++) {
      const attr = attributes[i];
      if (attr.value) {
        this.split(attr, attr.value, attr.valueStart, true);
      }
    }
  },
  pushText(state, node) {
    const text = node.text;
    const empty = !/\S/.test(text);
    const scryle = state.scryle;
    if (!scryle) {
      // state.last always have a nodes property
      const parent = state.last;
      const pack = this.compact && !parent.raw;
      if (pack && empty) {
        return
      }
      this.split(node, text, node.start, pack);
      parent.nodes.push(node);
    } else if (!empty) {
      scryle.text = node;
    }
  },
  split(node, source, start, pack) {
    const expressions = node.expr;
    const parts = [];
    if (expressions) {
      let pos = 0;
      for (let i = 0; i < expressions.length; i++) {
        const expr = expressions[i];
        const text = source.slice(pos, expr.start - start);
        let code = expr.text;
        if (this.prefixes.indexOf(code[0]) !== -1) {
          expr.prefix = code[0];
          code = code.substr(1);
        }
        parts.push(this._tt(node, text, pack), escapeReturn(escapeSlashes(code).trim()));
        pos = expr.end - start;
      }
      if ((pos += start) < node.end) {
        parts.push(this._tt(node, source.slice(pos), pack));
      }
    }
    else {
      parts[0] = this._tt(node, source, pack);
    }
    node.parts = parts;
  },
  // unescape escaped brackets and split prefixes of expressions
  _tt(node, text, pack) {
    let rep = node.unescape;
    if (rep) {
      let idx = 0;
      rep = `\\${rep}`;
      while ((idx = text.indexOf(rep, idx)) !== -1) {
        text = text.substr(0, idx) + text.substr(idx + 1);
        idx++;
      }
    }
    text = escapeSlashes(text);
    return pack ? cleanSpaces(text) : escapeReturn(text)
  }
});

function createTreeBuilder(data, options) {
  const root = {
    type: TAG,
    name: '',
    start: 0,
    end: 0,
    nodes: []
  };

  return Object.assign(Object.create(TREE_BUILDER_STRUCT), {
    compact: options.compact !== false,
    prefixes: '?=^',
    state: {
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

/**
 * Escape special characters in a given string, in preparation to create a regex.
 *
 * @param   {string} str - Raw string
 * @returns {string} Escaped string.
 */
var escapeStr = (str) => str.replace(/(?=[-[\](){^*+?.$|\\])/g, '\\')

/**
 * skipRegex v0.3.1
 * @author aMarCruz
 * @license MIT
 */
/** @exports skipRegex */
var skipRegex = (function () {

  // safe characters to precced a regex (including `=>`, `**`, and `...`)
  var beforeReChars = '[{(,;:?=|&!^~>%*/';
  var beforeReSign = beforeReChars + '+-';

  // keyword that can preceed a regex (`in` is handled as special case)
  var beforeReWords = [
    'case',
    'default',
    'do',
    'else',
    'in',
    'instanceof',
    'prefix',
    'return',
    'typeof',
    'void',
    'yield'
  ];

  // Last chars of all the beforeReWords elements to speed up the process.
  var wordsEndChar = beforeReWords.reduce(function (s, w) { return s + w.slice(-1); }, '');

  // Matches literal regex from the start of the buffer.
  // The buffer to search must not include line-endings.
  var RE_LIT_REGEX = /^\/(?=[^*>/])[^[/\\]*(?:(?:\\.|\[(?:\\.|[^\]\\]*)*\])[^[\\/]*)*?\/[gimuy]*/;

  // Valid characters for JavaScript variable names and literal numbers.
  var RE_JS_VCHAR = /[$\w]/;

  /**
   * Searches the position of the previous non-blank character inside `code`,
   * starting with `pos - 1`.
   *
   * @param   {string} code - Buffer to search
   * @param   {number} pos  - Starting position
   * @returns {number} Position of the first non-blank character to the left.
   * @private
   */
  function _prev(code, pos) {
    while (--pos >= 0 && /\s/.test(code[pos])){  }
    return pos
  }

  /**
   * Check if the character in the `start` position within `code` can be a regex
   * and returns the position following this regex or `start+1` if this is not
   * one.
   *
   * NOTE: Ensure `start` points to a slash (this is not checked).
   *
   * @function skipRegex
   * @param   {string} code  - Buffer to test in
   * @param   {number} start - Position the first slash inside `code`
   * @returns {number} Position of the char following the regex.
   *
   */
  return function skipRegex(code, start) {

    var re = /.*/g;
    var pos = re.lastIndex = start++;

    // `exec()` will extract from the slash to the end of the line
    //   and the chained `match()` will match the possible regex.
    var match = (re.exec(code) || ' ')[0].match(RE_LIT_REGEX);

    if (match) {
      var next = pos + match[0].length;      // result comes from `re.match`

      pos = _prev(code, pos);
      var c = code[pos];

      // start of buffer or safe prefix?
      if (pos < 0 || ~beforeReChars.indexOf(c)) {
        return next
      }

      // from here, `pos` is >= 0 and `c` is code[pos]
      if (c === '.') {
        // can be `...` or something silly like 5./2
        if (code[pos - 1] === '.') {
          start = next;
        }

      } else {

        if (c === '+' || c === '-') {
          // tricky case
          if (code[--pos] !== c ||            // if have a single operator or
             (pos = _prev(code, pos)) < 0 ||  // ...have `++` and no previous token
             ~beforeReSign.indexOf(c = code[pos])) {
            return next                       // ...this is a regex
          }
        }

        if (~wordsEndChar.indexOf(c)) {  // looks like a keyword?
          var end = pos + 1;

          // get the complete (previous) keyword
          while (--pos >= 0 && RE_JS_VCHAR.test(code[pos])){  }

          // it is in the allowed keywords list?
          if (~beforeReWords.indexOf(code.slice(pos + 1, end))) {
            start = next;
          }
        }
      }
    }

    return start
  }

})();

const $_ES6_BQ = '`';
/**
 * Searches the next backquote that signals the end of the ES6 Template Literal
 * or the "${" sequence that starts a JS expression, skipping any escaped
 * character.
 *
 * @param   {string}    code  - Whole code
 * @param   {number}    pos   - The start position of the template
 * @param   {string[]}  stack - To save nested ES6 TL count
 * @returns {number}    The end of the string (-1 if not found)
 */
function skipES6TL(code, pos, stack) {
  // we are in the char following the backquote (`),
  // find the next unescaped backquote or the sequence "${"
  const re = /[`$\\]/g;
  let c;
  while (re.lastIndex = pos, re.exec(code)) {
    pos = re.lastIndex;
    c = code[pos - 1];
    if (c === '`') {
      return pos
    }
    if (c === '$' && code[pos++] === '{') {
      stack.push($_ES6_BQ, '}');
      return pos
    }
    // else this is an escaped char
  }
  throw new Error('Unclosed ES6 template')
}

/*
 * Mini-parser for expressions.
 * The main pourpose of this module is to find the end of an expression
 * and return its text without the enclosing brackets.
 * Does not works with comments, but supports ES6 template strings.
 */
/**
 * @exports exprExtr
 */
const S_SQ_STR = /'[^'\n\r\\]*(?:\\(?:\r\n?|[\S\s])[^'\n\r\\]*)*'/.source;
/**
 * Matches double quoted JS strings taking care about nested quotes
 * and EOLs (escaped EOLs are Ok).
 *
 * @const
 * @private
 */
const S_STRING = `${S_SQ_STR}|${S_SQ_STR.replace(/'/g, '"')}`;
/**
 * Regex cache
 *
 * @type {Object.<string, RegExp>}
 * @const
 * @private
 */
const reBr = {};
/**
 * Makes an optimal regex that matches quoted strings, brackets, backquotes
 * and the closing brackets of an expression.
 *
 * @param   {string} b - Closing brackets
 * @returns {RegExp}
 */
function _regex(b) {
  let re = reBr[b];
  if (!re) {
    let s = escapeStr(b);
    if (b.length > 1) {
      s = s + '|[';
    } else {
      s = /[{}[\]()]/.test(b) ? '[' : `[${s}`;
    }
    reBr[b] = re = new RegExp(`${S_STRING}|${s}\`/\\{}[\\]()]`, 'g');
  }
  return re
}

/**
 * Update the scopes stack removing or adding closures to it
 * @param   {array} stack - array stacking the expression closures
 * @param   {string} char - current char to add or remove from the stack
 * @param   {string} idx  - matching index
 * @param   {string} code - expression code
 * @returns {object} result
 * @returns {object} result.char - either the char received or the closing braces
 * @returns {object} result.index - either a new index to skip part of the source code,
 *                                  or 0 to keep from parsing from the old position
 */
function updateStack(stack, char, idx, code) {
  let index = 0;

  switch (char) {
  case '[':
  case '(':
  case '{':
    stack.push(char === '[' ? ']' : char === '(' ? ')' : '}');
    break
  case ')':
  case ']':
  case '}':
    if (char !== stack.pop()) {
      throw new Error(`Unexpected character '${char}'`)
    }

    if (char === '}' && stack[stack.length - 1] === $_ES6_BQ) {
      char = stack.pop();
    }

    index = idx + 1;
    break
  case '/':
    index = skipRegex(code, idx);
  }

  return { char, index }
}

/**
   * Parses the code string searching the end of the expression.
   * It skips braces, quoted strings, regexes, and ES6 template literals.
   *
   * @function exprExtr
   * @param   {string}  code  - Buffer to parse
   * @param   {number}  start - Position of the opening brace
   * @param   {[string,string]} bp - Brackets pair
   * @returns {(Object | null)} Expression's end (after the closing brace) or -1
   *                            if it is not an expr.
   */
function exprExtr(code, start, bp) {
  const [openingBraces, closingBraces] = bp;
  const offset = start + openingBraces.length; // skips the opening brace
  const stack = []; // expected closing braces ('`' for ES6 TL)
  const re = _regex(closingBraces);

  re.lastIndex = offset; // begining of the expression

  let end;
  let match;

  while (match = re.exec(code)) {
    const idx = match.index;
    const str = match[0];
    end = re.lastIndex;

    // end the iteration
    if (str === closingBraces && !stack.length) {
      return {
        text: code.slice(offset, idx),
        start,
        end,
      }
    }

    const { char, index } = updateStack(stack, str[0], idx, code);
    // update the end value depending on the new index received
    end = index || end;
    // update the regex last index
    re.lastIndex = char === $_ES6_BQ ? skipES6TL(code, end, stack) : end;
  }

  if (stack.length) {
    throw new Error('Unclosed expression.')
  }

  return null
}

/**
 * Matches the start of valid tags names; used with the first 2 chars after the `'<'`.
 * @const
 * @private
 */
const TAG_2C = /^(?:\/[a-zA-Z]|[a-zA-Z][^\s>/]?)/;
/**
 * Matches valid tags names AFTER the validation with `TAG_2C`.
 * $1: tag name including any `'/'`, $2: non self-closing brace (`>`) w/o attributes.
 * @const
 * @private
 */
const TAG_NAME = /(\/?[^\s>/]+)\s*(>)?/g;
/**
 * Matches an attribute name-value pair (both can be empty).
 * $1: attribute name, $2: value including any quotes.
 * @const
 * @private
 */
const ATTR_START = /(\S[^>/=\s]*)(?:\s*=\s*([^>/])?)?/g;
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
};

/**
 * Matches the beginning of an `export default {}` expression
 * @const
 * @private
 */
const EXPORT_DEFAULT = /export(?:\W)+default(?:\s+)?{/g;

/**
 * Factory for the Parser class, exposing only the `parse` method.
 * The export adds the Parser class as property.
 *
 * @param   {Object}   options - User Options
 * @param   {Function} customBuilder - Tree builder factory
 * @returns {Function} Public Parser implementation.
 */
function parser$1(options, customBuilder) {
  const builderFactory = customBuilder || createTreeBuilder;
  const store = {
    options: Object.assign({
      brackets: ['{', '}']
    }, options)
  };

  return {
    /**
     * It creates a raw output of pseudo-nodes with one of three different types,
     * all of them having a start/end position:
     *
     * - TAG     -- Opening or closing tags
     * - TEXT    -- Raw text
     * - COMMENT -- Comments
     *
     * @param   {string} data - HTML markup
     * @returns {ParserResult} Result, contains data and output properties.
     */
    parse(data) {
      // extend the store adding the tree builder instance and the initial data
      Object.assign(store, {
        regexCache: {},
        pos: 0,
        count: -1,
        root: null,
        last: null,
        scryle: null,
        builder: builderFactory(data, options),
        data
      });

      const length = data.length;
      let type;

      // The "count" property is set to 1 when the first tag is found.
      // This becomes the root and precedent text or comments are discarded.
      // So, at the end of the parsing count must be zero.
      while (store.pos < length && store.count) {
        switch (type) {
        case TAG:
          type = tag(store, data);
          break
        case ATTR:
          type = attr(store, data);
          break
        default:
          type = text(store, data);
        }
      }

      flush(store);

      if (store.count) {
        err(data, store.count > 0
          ? unexpectedEndOfFile : rootTagNotFound, store.pos);
      }

      return {
        data,
        output: store.builder.get()
      }
    }
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
  const message = formatError(data, msg, pos);
  throw new Error(message)
}

/**
 * Outputs the last parsed node. Can be used with a builder too.
 *
 * @param {ParserStore} store - Parsing store
 * @private
 */
function flush(store) {
  const last = store.last;
  store.last = null;
  if (last && store.root) {
    store.builder.push(last);
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
  flush(store);
  store.pos = end;
  if (store.options.comments === true) {
    store.last = { type: COMMENT, start, end };
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
  const text = getChunk(store.data, start, end);
  let q = store.last;
  store.pos = end;

  if (q && q.type === TEXT) {
    q.text += text;
    q.end = end;
  } else {
    flush(store);
    store.last = q = { type: TEXT, text, start, end };
  }

  if (expr) {
    q.expr = (q.expr || []).concat(expr);
  }

  if (rep) {
    q.unescape = rep;
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
  const root = store.root;
  const last = { type: TAG, name, start, end };
  store.pos = end;
  if (root) {
    if (name === root.name) {
      store.count++;
    }
    else if (name === root.close) {
      store.count--;
    }
    flush(store);
  } else {
    // start with root (keep ref to output)
    store.root = { name: last.name, close: `/${name}` };
    store.count = 1;
  }
  store.last = last;
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
  const pos = store.pos; // pos of the char following '<'
  const start = pos - 1; // pos of '<'
  const str = data.substr(pos, 2); // first two chars following '<'
  if (str[0] === '!') {
    comment(store, data, start);
  } else if (TAG_2C.test(str)) {
    const re = TAG_NAME; // (\/?[^\s>/]+)\s*(>)? g
    re.lastIndex = pos;
    const match = re.exec(data);
    const end = re.lastIndex;
    const name = match[1].toLowerCase(); // $1: tag name including any '/'
    // script/style block is parsed as another tag to extract attributes
    if (name in RE_SCRYLE) {
      store.scryle = name; // used by parseText
    }
    pushTag(store, name, start, end);
    // only '>' can ends the tag here, the '/' is handled in parseAttr
    if (!match[2]) {
      return ATTR
    }
  } else {
    pushText(store, start, pos); // pushes the '<' as text
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
  const pos = start + 2; // skip '<!'
  const str = data.substr(pos, 2) === '--' ? '-->' : '>';
  const end = data.indexOf(str, pos);
  if (end < 0) {
    err(data, unclosedComment, start);
  }
  pushcomment(store, start, end + str.length);
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
  const tag = store.last; // the last (current) tag in the output
  const _CH = /\S/g; // matches the first non-space char
  _CH.lastIndex = store.pos; // first char of attribute's name
  const ch = _CH.exec(data);
  if (!ch) {
    store.pos = data.length; // reaching the end of the buffer with
    // NodeTypes.ATTR will generate error
  } else if (ch[0] === '>') {
    // closing char found. If this is a self-closing tag with the name of the
    // Root tag, we need decrement the counter as we are changing mode.
    store.pos = tag.end = _CH.lastIndex;
    if (tag.selfclose) {
      store.scryle = null; // allow selfClosing script/style tags
      if (store.root && store.root.name === tag.name) {
        store.count--; // "pop" root tag
      }
    }
    return TEXT
  } else if (ch[0] === '/') {
    store.pos = _CH.lastIndex; // maybe. delegate the validation
    tag.selfclose = true; // the next loop
  } else {
    delete tag.selfclose; // ensure unmark as selfclosing tag
    setAttr(store, data, ch.index, tag);
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
  const re = ATTR_START; // (\S[^>/=\s]*)(?:\s*=\s*([^>/])?)? g
  const start = re.lastIndex = pos; // first non-whitespace
  const match = re.exec(data);

  if (!match) {
    return
  }

  let end = re.lastIndex;
  let quote = match[2]; // first letter of value or nothing
  const attr = { name: match[1], value: '', start, end };
  // parse the whole value (if any) and get any expressions on it
  if (quote) {
    // Usually, the value's first char (`quote`) is a quote and the lastIndex
    // (`end`) is the start of the value.
    let valueStart = end;
    // If it not, this is an unquoted value and we need adjust the start.
    if (quote !== '"' && quote !== "'") {
      quote = ''; // first char of value is not a quote
      valueStart--; // adjust the starting position
    }

    end = expr(store, data, attr, quote || '[>/\\s]', valueStart);
    // adjust the bounds of the value and save its content
    attr.value = getChunk(data, valueStart, end);
    attr.valueStart = valueStart;
    attr.end = quote ? ++end : end;
  }

  //assert(q && q.type === Mode.TAG, 'no previous tag for the attr!')
  // Pushes the attribute and shifts the `end` position of the tag (`last`).
  store.pos = tag.end = end;
  (tag.attr || (tag.attr = [])).push(attr);
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
  const pos = store.pos; // start of the text

  if (store.scryle) {
    const name = store.scryle;
    const re = RE_SCRYLE[name];
    re.lastIndex = pos;
    const match = re.exec(data);
    if (!match) {
      err(data, unclosedNamedBlock.replace('%1', name), pos - 1);
    }
    const start = match.index;
    const end = re.lastIndex;
    store.scryle = null; // reset the script/style flag now
    // write the tag content, if any
    if (start > pos) {
      switch (name) {
      case 'textarea':
        expr(store, data, null, match[0], pos);
        break
      case 'script':
        pushText(store, pos, start);
        pushJavascript(store, pos, start);
        break
      default:
        pushText(store, pos, start);
      }
    }
    // now the closing tag, either </script> or </style>
    pushTag(store, `/${name}`, start, end);
  } else if (data[pos] === '<') {
    store.pos++;
    return TAG
  } else {
    expr(store, data, null, '<', pos);
  }

  return TEXT
}

/**
 * Create the javascript nodes depending
 *
 * @param {ParserStore}   store   - Current parser store
 * @param {number}  start   - Start position of the tag
 * @param {number}  end     - Ending position (last char of the tag)
 * @param {string}  [rep]   - Brackets to unescape
 * @private
 */
function pushJavascript(store, start, end) {
  const code = getChunk(store.data, start, end);
  const nodes = [];
  const match = EXPORT_DEFAULT.exec(code);
  store.pos = end;

  // no export rules found
  if (!match) {
    nodes.push(getPrivateJs(code, 0, code.length, start));
  } else {
    const publicJsIndex = EXPORT_DEFAULT.lastIndex;
    const publicJs = exprExtr(code.substr(publicJsIndex, end), 0, ['{', '}']);[
      getPrivateJs(code, start, 0, match.index),
      {
        type: PUBLIC_JAVASCRIPT,
        start: start + publicJsIndex,
        end: start + publicJs.end,
        code: publicJs.text
      },
      getPrivateJs(code, start, publicJs.end, code.length)
    ].forEach(nodes.push.bind(nodes));
  }

  nodes
    // filter null nodes
    .filter(node => node)
    .forEach(node => store.builder.push(node));
}

function getPrivateJs(code, offset, start, end) {
  const match = code.substr(start, end).trim();

  if (!match) return null

  return {
    type: PRIVATE_JAVASCRIPT,
    start: start + offset,
    end: end + offset,
    code: match
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
  const start = pos;
  const { brackets } = store.options;
  const re = b0re(store, endingChars);

  let expr;
  let unescape = '';
  let match;

  re.lastIndex = pos;

  // Anything captured in $1 (closing quote or character) ends the loop...
  while ((match = re.exec(data)) && !match[1]) {
    // ...else, we have an opening bracket and maybe an expression.
    pos = match.index;
    if (data[pos - 1] === '\\') {
      unescape = match[0]; // it is an escaped opening brace
    } else {
      const tmpExpr = exprExtr(data, pos, brackets);
      if (tmpExpr) {
        (expr || (expr = [])).push(tmpExpr);
        re.lastIndex = tmpExpr.end;
      }
    }
  }

  // Even for text, the parser needs match a closing char
  if (!match) {
    err(data, unexpectedEndOfFile, pos);
  }
  const end = match.index;
  if (node) {
    if (unescape) {
      node.unescape = unescape;
    }
    if (expr) {
      node.expr = expr;
    }
  } else {
    pushText(store, start, end, expr, unescape);
  }

  return end
}

/**
 * Get the code chunks from start and end range
 * @param   {string}  source  - source code
 * @param   {number}  start   - Start position of the chunk we want to extract
 * @param   {number}  end     - Ending position of the chunk we need
 * @returns {string}  chunk of code extracted from the source code received
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
  const { brackets } = store.options;
  const re = store.regexCache[str];

  if (re) return re

  const b0 = escapeStr(brackets[0]);
  // cache the regex extending the regexCache object
  Object.assign(store.regexCache, { [str]: new RegExp(`(${str})|${b0}`, 'g' ) });

  return store.regexCache[str]
}

/**
 * The nodeTypes definition
 */
const nodeTypes = _nodeTypes;

exports.nodeTypes = nodeTypes;
exports['default'] = parser$1;

Object.defineProperty(exports, '__esModule', { value: true });

})));
