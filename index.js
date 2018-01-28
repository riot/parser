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

/**
 * Custom error handler can be implemented replacing this method.
 * The `state` object includes the buffer (`data`)
 * The error position (`loc`) contains line (base 1) and col (base 0).
 *
 * @param {string} msg   - Error message
 * @param {pos} [number] - Position of the error
 */
function panic(data, msg, pos) {
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

const rootTagNotFound = 'Root tag not found.';
const unclosedTemplateLiteral = 'Unclosed ES6 template literal';
const emptyStack = 'Stack is empty.';
const unexpectedEndOfFile = 'Unexpected end of file.';

const unclosedComment = 'Unclosed comment.';
const unclosedNamedBlock = 'Unclosed "%1" block.';
const duplicatedNamedTag = 'Duplicate tag "<%1>".';

const unableToParseExportDefault = 'Unable to parse your tag \'export default\' contents.';

const html = [
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
];
const svg = [
  'circle',
  'ellipse',
  'line',
  'path',
  'polygon',
  'polyline',
  'rect',
  'stop',
  'use'
];
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
  html,
  /**
   * SVG void elements that cannot be auto-closed and shouldn't contain child nodes.
   *
   * @const {Array.<string>}
   */
  svg,
  // Regex to match all of them
  regex: new RegExp(`^/?(?:${html.join('|')}|${svg.join('|')})$`, 'i')
}

/**
 * Add an item into a collection, if the collection is not an array
 * we create one and add the item to it
 * @param   {array} collection - target collection
 * @param   {*} item - item to add to the collection
 * @returns {array} array containing the new item added to it
 */
function addToCollection(collection = [], item) {
  collection.push(item);
  return collection
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
  textarea: /<\/textarea\s*>/gi
};

/**
 * Matches the beginning of an `export default {}` expression
 * @const
 * @private
 */
const EXPORT_DEFAULT = /export(?:\W)+default(?:\s+)?{/g;

// Do not touch text content inside this tags
const RAW_TAGS = /^\/?(?:pre|textarea)$/;

const SVG_NS = 'http://www.w3.org/2000/svg';

const JAVASCRIPT_OUTPUT_NAME = 'javascript';
const CSS_OUTPUT_NAME = 'css';
const TEMPLATE_OUTPUT_NAME = 'template';

// Tag names
const JAVASCRIPT_TAG = 'script';
const STYLE_TAG = 'style';
const TEXTAREA_TAG = 'textarea';

const SVG_TAG = 'svg';

const DEFER_ATTR = 'defer';

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
  * @param {Object} node - Raw pseudo-node from the parser
  */
  push(node) {
    const state = this.state;

    switch (node.type) {
    case TEXT:
      this.pushText(state, node);
      break
    case TAG: {
      const name = node.name;
      if (name[0] === '/') {
        this.closeTag(state, node, name);
      } else {
        this.openTag(state, node);
      }
      break
    }
    case PRIVATE_JAVASCRIPT:
    case PUBLIC_JAVASCRIPT:
      state[JAVASCRIPT_TAG].nodes = addToCollection(state[JAVASCRIPT_TAG].nodes, node);
      break
    }
  },
  closeTag(state, node, name) { // eslint-disable-line
    const last = state.scryle || state.last;

    last.end = node.end;

    if (state.scryle) {
      state.scryle = null;
    } else {
      if (!state.stack[0]) {
        panic(this.state.data, emptyStack, last.start);
      }
      state.last = state.stack.pop();
    }
  },

  openTag(state, node) {
    const name = node.name;
    const ns = state.last.ns || (name === SVG_TAG ? SVG_NS : '');
    const attrs = node.attributes;
    if (attrs && !ns) {
      attrs.forEach(a => { a.name = a.name.toLowerCase(); });
    }
    if ([JAVASCRIPT_TAG, STYLE_TAG].includes(name) && !this.deferred(node, attrs)) {
      // Only accept one of each
      if (state[name]) {
        panic(this.state.data, duplicatedNamedTag.replace('%1', name), node.start);
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
      } else {
        voids = voidTags.html;
      }
      if (voids.indexOf(name) !== -1) {
        newNode.void = true;
      } else if (!node.selfclose) {
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
        if (attributes[i].name === DEFER_ATTR) {
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
    const expressions = node.expressions;
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
    } else {
      parts[0] = this._tt(node, source, pack);
    }

    node.parts = parts.filter(p => p); // remove the empty strings
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
 * Function to curry any javascript method
 * @param   {Function}  fn - the target function we want to curry
 * @param   {...[args]} acc - initial arguments
 * @returns {Function|*} it will return a function until the target function
 *                       will receive all of its arguments
 */
function curry(fn, ...acc) {
  return (...args) => {
    args = [...acc, ...args];

    return args.length < fn.length ?
      curry(fn, ...args) :
      fn(...args)
  }
}

/**
 * Run RegExp.exec starting from a specific position
 * @param   {RegExp} re - regex
 * @param   {number} pos - last index position
 * @param   {string} string - regex target
 * @returns {array} regex result
 */
function execFromPos(re, pos, string) {
  re.lastIndex = pos;
  return re.exec(string)
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

/**
 * Escape special characters in a given string, in preparation to create a regex.
 *
 * @param   {string} str - Raw string
 * @returns {string} Escaped string.
 */
var escapeStr = (str) => str.replace(/(?=[-[\](){^*+?.$|\\])/g, '\\')

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
  throw formatError(code, unclosedTemplateLiteral, pos)
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
  const re = b0re(store, endingChars);

  re.lastIndex = start; // reset re position

  const { unescape, expressions, end } = parseExpressions(store, re);

  if (node) {
    if (unescape) {
      node.unescape = unescape;
    }
    if (expressions.length) {
      node.expressions = expressions;
    }
  } else {
    pushText(store, start, end, {expressions, unescape});
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
  const { data, options } = store;
  const { brackets } = options;
  const expressions = [];
  let unescape, pos, match;

  // Anything captured in $1 (closing quote or character) ends the loop...
  while ((match = re.exec(data)) && !match[1]) {
    // ...else, we have an opening bracket and maybe an expression.
    pos = match.index;
    if (data[pos - 1] === '\\') {
      unescape = match[0]; // it is an escaped opening brace
    } else {
      const tmpExpr = exprExtr(data, pos, brackets);
      if (tmpExpr) {
        expressions.push(tmpExpr);
        re.lastIndex = tmpExpr.end;
      }
    }
  }

  // Even for text, the parser needs match a closing char
  if (!match) {
    panic(data, unexpectedEndOfFile, pos);
  }

  return {
    unescape,
    expressions,
    end: match.index
  }
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
 * Create the javascript nodes
 * @param {ParserStore} store  - Current parser store
 * @param {number}  start   - Start position of the tag
 * @param {number}  end     - Ending position (last char of the tag)
 * @private
 */
function pushJavascript(store, start, end) {
  const code = getChunk(store.data, start, end);
  const push = store.builder.push.bind(store.builder);
  const match = EXPORT_DEFAULT.exec(code);
  store.pos = end;

  // no export rules found
  // skip the nodes creation
  if (!match) return

  // find the export default index
  const publicJsIndex = EXPORT_DEFAULT.lastIndex;
  // get the content of the export default tag
  // the exprExtr was meant to be used for expressions but it works
  // perfectly also in this case matching everything there is in { ... } block
  const publicJs = exprExtr(getChunk(code, publicJsIndex, end), 0, ['{', '}']);

  // dispatch syntax errors
  if (!publicJs) {
    panic(store.data, unableToParseExportDefault, start + publicJsIndex);
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
  ].filter(n => n.code).forEach(push);
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
  const text = getChunk(store.data, start, end);
  const expressions = extra.expressions;
  const unescape = extra.unescape;

  let q = store.last;
  store.pos = end;

  if (q && q.type === TEXT) {
    q.text += text;
    q.end = end;
  } else {
    flush(store);
    store.last = q = { type: TEXT, text, start, end };
  }

  if (expressions && expressions.length) {
    q.expressions = (q.expressions || []).concat(expressions);
  }

  if (unescape) {
    q.unescape = unescape;
  }

  return TEXT
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
  const { pos, data, scryle } = store;

  switch (true) {
  case typeof scryle === 'string': {
    const name = scryle;
    const re = RE_SCRYLE[name];
    const match = execFromPos(re, pos, data);

    if (!match) {
      panic(data, unclosedNamedBlock.replace('%1', name), pos - 1);
    }

    const start = match.index;
    const end = re.lastIndex;
    store.scryle = null; // reset the script/style flag now
    // write the tag content, if any
    if (start > pos) {
      parseSpecialTagsContent(store, name, match);
    }
    // now the closing tag, either </script> or </style>
    pushTag(store, `/${name}`, start, end);
    break
  }
  case data[pos] === '<':
    store.pos++;
    return TAG
  default:
    expr(store, null, '<', pos);
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
  const { pos } = store;
  const start = match.index;

  switch (name) {
  case TEXTAREA_TAG:
    expr(store, null, match[0], pos);
    break
  case JAVASCRIPT_TAG:
    pushText(store, pos, start);
    pushJavascript(store, pos, start);
    break
  default:
    pushText(store, pos, start);
  }
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
    panic(data, unclosedComment, start);
  }
  pushComment(store, start, end + str.length);

  return TEXT
}

/**
 * Stores a comment.
 *
 * @param {ParserStore}  store - Current parser store
 * @param {number}  start - Start position of the tag
 * @param {number}  end   - Ending position (last char of the tag)
 * @private
 */
function pushComment(store, start, end) {
  flush(store);
  store.pos = end;
  if (store.options.comments === true) {
    store.last = { type: COMMENT, start, end };
  }
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
  const { pos, data } = store; // pos of the char following '<'
  const start = pos - 1; // pos of '<'
  const str = data.substr(pos, 2); // first two chars following '<'

  switch (true) {
  case str[0] === '!':
    return comment(store, data, start)
  case TAG_2C.test(str):
    return parseTag(store, start)
  default:
    return pushText(store, start, pos) // pushes the '<' as text
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
    } else if (name === root.close) {
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

function parseTag(store, start) {
  const { data, pos } = store;
  const re = TAG_NAME; // (\/?[^\s>/]+)\s*(>)? g
  const match = execFromPos(re, pos, data);
  const end = re.lastIndex;
  const name = match[1].toLowerCase(); // $1: tag name including any '/'
  // script/style block is parsed as another tag to extract attributes
  if (name in RE_SCRYLE) {
    store.scryle = name; // used by parseText
  }

  pushTag(store, name, start, end);
  // only '>' can ends the tag here, the '/' is handled in parseAttribute
  if (!match[2]) {
    return ATTR
  }

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
  const { data, last, pos, root } = store;
  const tag = last; // the last (current) tag in the output
  const _CH = /\S/g; // matches the first non-space char
  const ch = execFromPos(_CH, pos, data);

  switch (true) {
  case !ch:
    store.pos = data.length; // reaching the end of the buffer with
    // NodeTypes.ATTR will generate error
    break
  case ch[0] === '>':
    // closing char found. If this is a self-closing tag with the name of the
    // Root tag, we need decrement the counter as we are changing mode.
    store.pos = tag.end = _CH.lastIndex;
    if (tag.selfclose) {
      store.scryle = null; // allow selfClosing script/style tags
      if (root && root.name === tag.name) {
        store.count--; // "pop" root tag
      }
    }
    return TEXT
  case ch[0] === '/':
    store.pos = _CH.lastIndex; // maybe. delegate the validation
    tag.selfclose = true; // the next loop
    break
  default:
    delete tag.selfclose; // ensure unmark as selfclosing tag
    setAttribute(store, ch.index, tag);
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
  const { data } = store;
  const re = ATTR_START; // (\S[^>/=\s]*)(?:\s*=\s*([^>/])?)? g
  const start = re.lastIndex = pos; // first non-whitespace
  const match = re.exec(data);

  if (!match) {
    return
  }

  let end = re.lastIndex;
  const attr = parseAttribute(store, match, start, end);

  //assert(q && q.type === Mode.TAG, 'no previous tag for the attr!')
  // Pushes the attribute and shifts the `end` position of the tag (`last`).
  store.pos = tag.end = attr.end;
  tag.attributes = addToCollection(tag.attributes, attr);
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
  const { data } = store;
  const attr = { name: match[1], value: '', start, end };

  let quote = match[2]; // first letter of value or nothing

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

    end = expr(store, attr, quote || '[>/\\s]', valueStart);

    // adjust the bounds of the value and save its content
    Object.assign(attr, {
      value: getChunk(data, valueStart, end),
      valueStart,
      end: quote ? ++end : end
    });
  }

  return attr
}

/**
 * Factory for the Parser class, exposing only the `parse` method.
 * The export adds the Parser class as property.
 *
 * @param   {Object}   options - User Options
 * @param   {Function} customBuilder - Tree builder factory
 * @returns {Function} Public Parser implementation.
 */
function parser$1(options, customBuilder) {
  const store = curry(createStore)(options, customBuilder || createTreeBuilder);
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
  }, userOptions);

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
  const { data } = store;

  walk(store);
  flush(store);

  if (store.count) {
    panic(data, store.count > 0 ? unexpectedEndOfFile : rootTagNotFound, store.pos);
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
  const { data } = store;
  // extend the store adding the tree builder instance and the initial data
  const length = data.length;

  // The "count" property is set to 1 when the first tag is found.
  // This becomes the root and precedent text or comments are discarded.
  // So, at the end of the parsing count must be zero.
  if (store.pos < length && store.count) {
    walk(store, eat(store, type));
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
 * The nodeTypes definition
 */
const nodeTypes = _nodeTypes;

exports.nodeTypes = nodeTypes;
exports['default'] = parser$1;
exports.voidTags = voidTags;

Object.defineProperty(exports, '__esModule', { value: true });

})));
