'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const JAVASCRIPT_OUTPUT_NAME = 'javascript';
const CSS_OUTPUT_NAME = 'css';
const TEMPLATE_OUTPUT_NAME = 'template';

// Tag names
const JAVASCRIPT_TAG = 'script';
const STYLE_TAG = 'style';
const TEXTAREA_TAG = 'textarea';

// Boolean attributes
const IS_RAW = 'isRaw';
const IS_SELF_CLOSING = 'isSelfClosing';
const IS_VOID = 'isVoid';
const IS_BOOLEAN = 'isBoolean';
const IS_CUSTOM = 'isCustom';
const IS_SPREAD = 'isSpread';

var c = /*#__PURE__*/Object.freeze({
  __proto__: null,
  JAVASCRIPT_OUTPUT_NAME: JAVASCRIPT_OUTPUT_NAME,
  CSS_OUTPUT_NAME: CSS_OUTPUT_NAME,
  TEMPLATE_OUTPUT_NAME: TEMPLATE_OUTPUT_NAME,
  JAVASCRIPT_TAG: JAVASCRIPT_TAG,
  STYLE_TAG: STYLE_TAG,
  TEXTAREA_TAG: TEXTAREA_TAG,
  IS_RAW: IS_RAW,
  IS_SELF_CLOSING: IS_SELF_CLOSING,
  IS_VOID: IS_VOID,
  IS_BOOLEAN: IS_BOOLEAN,
  IS_CUSTOM: IS_CUSTOM,
  IS_SPREAD: IS_SPREAD
});

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

var types = /*#__PURE__*/Object.freeze({
  __proto__: null,
  TAG: TAG,
  ATTR: ATTR,
  TEXT: TEXT,
  CDATA: CDATA,
  COMMENT: COMMENT,
  DOCUMENT: DOCUMENT,
  DOCTYPE: DOCTYPE,
  DOCUMENT_FRAGMENT: DOCUMENT_FRAGMENT
});

const rootTagNotFound = 'Root tag not found.';
const unclosedTemplateLiteral = 'Unclosed ES6 template literal.';
const unexpectedEndOfFile = 'Unexpected end of file.';
const unclosedComment = 'Unclosed comment.';
const unclosedNamedBlock = 'Unclosed "%1" block.';
const duplicatedNamedTag = 'Multiple inline "<%1>" tags are not supported.';
const unexpectedCharInExpression = 'Unexpected character %1.';
const unclosedExpression = 'Unclosed expression.';

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
 * Matches the spread operator
 * it will be used for the spread attributes
 * @type {RegExp}
 */
const SPREAD_OPERATOR = /\.\.\./;
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

// Do not touch text content inside this tags
const RAW_TAGS = /^\/?(?:pre|textarea)$/;

/**
 * Add an item into a collection, if the collection is not an array
 * we create one and add the item to it
 * @param   {Array} collection - target collection
 * @param   {*} item - item to add to the collection
 * @returns {Array} array containing the new item added to it
 */
function addToCollection(collection = [], item) {
  collection.push(item);
  return collection
}

/**
 * Run RegExp.exec starting from a specific position
 * @param   {RegExp} re - regex
 * @param   {number} pos - last index position
 * @param   {string} string - regex target
 * @returns {Array} regex result
 */
function execFromPos(re, pos, string) {
  re.lastIndex = pos;
  return re.exec(string)
}

/**
 * Escape special characters in a given string, in preparation to create a regex.
 *
 * @param   {string} str - Raw string
 * @returns {string} Escaped string.
 */
var escapeStr = (str) => str.replace(/(?=[-[\](){^*+?.$|\\])/g, '\\');

function formatError(data, message, pos) {
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

/**
 * Custom error handler can be implemented replacing this method.
 * The `state` object includes the buffer (`data`)
 * The error position (`loc`) contains line (base 1) and col (base 0).
 * @param {string} data - string containing the error
 * @param {string} msg - Error message
 * @param {number} pos - Position of the error
 * @returns {undefined} throw an exception error
 */
function panic(data, msg, pos) {
  const message = formatError(data, msg, pos);
  throw new Error(message)
}

// forked from https://github.com/aMarCruz/skip-regex

// safe characters to precced a regex (including `=>`, `**`, and `...`)
const beforeReChars = '[{(,;:?=|&!^~>%*/';
const beforeReSign = `${beforeReChars}+-`;

// keyword that can preceed a regex (`in` is handled as special case)
const beforeReWords = [
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
const wordsEndChar = beforeReWords.reduce((s, w) => s + w.slice(-1), '');

// Matches literal regex from the start of the buffer.
// The buffer to search must not include line-endings.
const RE_LIT_REGEX = /^\/(?=[^*>/])[^[/\\]*(?:(?:\\.|\[(?:\\.|[^\]\\]*)*\])[^[\\/]*)*?\/[gimuy]*/;

// Valid characters for JavaScript variable names and literal numbers.
const RE_JS_VCHAR = /[$\w]/;

// Match dot characters that could be part of tricky regex
const RE_DOT_CHAR = /.*/g;

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
  while (--pos >= 0 && /\s/.test(code[pos]));
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
/* istanbul ignore next */
function skipRegex(code, start) {
  let pos = RE_DOT_CHAR.lastIndex = start++;

  // `exec()` will extract from the slash to the end of the line
  //   and the chained `match()` will match the possible regex.
  const match = (RE_DOT_CHAR.exec(code) || ' ')[0].match(RE_LIT_REGEX);

  if (match) {
    const next = pos + match[0].length;      // result comes from `re.match`

    pos = _prev(code, pos);
    let c = code[pos];

    // start of buffer or safe prefix?
    if (pos < 0 || beforeReChars.includes(c)) {
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
             beforeReSign.includes(c = code[pos])) {
          return next                       // ...this is a regex
        }
      }

      if (wordsEndChar.includes(c)) {  // looks like a keyword?
        const end = pos + 1;

        // get the complete (previous) keyword
        while (--pos >= 0 && RE_JS_VCHAR.test(code[pos]));

        // it is in the allowed keywords list?
        if (beforeReWords.includes(code.slice(pos + 1, end))) {
          start = next;
        }
      }
    }
  }

  return start
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
 * @returns {RegExp} - optimized regex
 */
function _regex(b) {
  let re = reBr[b];
  if (!re) {
    let s = escapeStr(b);
    if (b.length > 1) {
      s = `${s}|[`;
    } else {
      s = /[{}[\]()]/.test(b) ? '[' : `[${s}`;
    }
    reBr[b] = re = new RegExp(`${S_STRING}|${s}\`/\\{}[\\]()]`, 'g');
  }
  return re
}

/**
 * Update the scopes stack removing or adding closures to it
 * @param   {Array} stack - array stacking the expression closures
 * @param   {string} char - current char to add or remove from the stack
 * @param   {string} idx  - matching index
 * @param   {string} code - expression code
 * @returns {Object} result
 * @returns {Object} result.char - either the char received or the closing braces
 * @returns {Object} result.index - either a new index to skip part of the source code,
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
      panic(code, unexpectedCharInExpression.replace('%1', char), index);
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
   * @returns {Object} Expression's end (after the closing brace) or -1
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

  while (match = re.exec(code)) { // eslint-disable-line
    const idx = match.index;
    const str = match[0];
    end = re.lastIndex;

    // end the iteration
    if (str === closingBraces && !stack.length) {
      return {
        text: code.slice(offset, idx),
        start,
        end
      }
    }

    const { char, index } = updateStack(stack, str[0], idx, code);
    // update the end value depending on the new index received
    end = index || end;
    // update the regex last index
    re.lastIndex = char === $_ES6_BQ ? skipES6TL(code, end, stack) : end;
  }

  if (stack.length) {
    panic(code, unclosedExpression, end);
  }
}

/**
 * Outputs the last parsed node. Can be used with a builder too.
 *
 * @param   {ParserStore} store - Parsing store
 * @returns {undefined} void function
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
 * states text in the last text node, or creates a new one if needed.
 *
 * @param {ParserState}   state   - Current parser state
 * @param {number}  start   - Start position of the tag
 * @param {number}  end     - Ending position (last char of the tag)
 * @param {Object}  extra   - extra properties to add to the text node
 * @param {RawExpr[]} extra.expressions  - Found expressions
 * @param {string}    extra.unescape     - Brackets to unescape
 * @returns {undefined} - void function
 * @private
 */
function pushText(state, start, end, extra = {}) {
  const text = getChunk(state.data, start, end);
  const expressions = extra.expressions;
  const unescape = extra.unescape;

  let q = state.last;
  state.pos = end;

  if (q && q.type === TEXT) {
    q.text += text;
    q.end = end;
  } else {
    flush(state);
    state.last = q = { type: TEXT, text, start, end };
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
 * Find the end of the attribute value or text node
 * Extract expressions.
 * Detect if value have escaped brackets.
 *
 * @param   {ParserState} state  - Parser state
 * @param   {HasExpr} node       - Node if attr, info if text
 * @param   {string} endingChars - Ends the value or text
 * @param   {number} start       - Starting position
 * @returns {number} Ending position
 * @private
 */
function expr(state, node, endingChars, start) {
  const re = b0re(state, endingChars);

  re.lastIndex = start; // reset re position

  const { unescape, expressions, end } = parseExpressions(state, re);

  if (node) {
    if (unescape) {
      node.unescape = unescape;
    }
    if (expressions.length) {
      node.expressions = expressions;
    }
  } else {
    pushText(state, start, end, {expressions, unescape});
  }

  return end
}

/**
 * Parse a text chunk finding all the expressions in it
 * @param   {ParserState} state  - Parser state
 * @param   {RegExp} re - regex to match the expressions contents
 * @returns {Object} result containing the expression found, the string to unescape and the end position
 */
function parseExpressions(state, re) {
  const { data, options } = state;
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
 * @param   {ParserState} state  - Parser state
 * @param   {string} str - String to search
 * @returns {RegExp} Resulting regex.
 * @private
 */
function b0re(state, str) {
  const { brackets } = state.options;
  const re = state.regexCache[str];

  if (re) return re

  const b0 = escapeStr(brackets[0]);
  // cache the regex extending the regexCache object
  Object.assign(state.regexCache, { [str]: new RegExp(`(${str})|${b0}`, 'g') });

  return state.regexCache[str]
}

// similar to _.uniq
const uniq = l => l.filter((x, i, a) => a.indexOf(x) === i);

/**
 * SVG void elements that cannot be auto-closed and shouldn't contain child nodes.
 * @const {Array}
 */
const VOID_SVG_TAGS_LIST = [
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

/**
 * List of html elements where the value attribute is allowed
 * @type {Array}
 */
const HTML_ELEMENTS_HAVING_VALUE_ATTRIBUTE_LIST = [
  'button',
  'data',
  'input',
  'select',
  'li',
  'meter',
  'option',
  'output',
  'progress',
  'textarea',
  'param'
];

/**
 * List of all the available svg tags
 * @const {Array}
 * @see {@link https://github.com/wooorm/svg-tag-names}
 */
const SVG_TAGS_LIST = uniq([
  'a',
  'altGlyph',
  'altGlyphDef',
  'altGlyphItem',
  'animate',
  'animateColor',
  'animateMotion',
  'animateTransform',
  'animation',
  'audio',
  'canvas',
  'clipPath',
  'color-profile',
  'cursor',
  'defs',
  'desc',
  'discard',
  'feBlend',
  'feColorMatrix',
  'feComponentTransfer',
  'feComposite',
  'feConvolveMatrix',
  'feDiffuseLighting',
  'feDisplacementMap',
  'feDistantLight',
  'feDropShadow',
  'feFlood',
  'feFuncA',
  'feFuncB',
  'feFuncG',
  'feFuncR',
  'feGaussianBlur',
  'feImage',
  'feMerge',
  'feMergeNode',
  'feMorphology',
  'feOffset',
  'fePointLight',
  'feSpecularLighting',
  'feSpotLight',
  'feTile',
  'feTurbulence',
  'filter',
  'font',
  'font-face',
  'font-face-format',
  'font-face-name',
  'font-face-src',
  'font-face-uri',
  'foreignObject',
  'g',
  'glyph',
  'glyphRef',
  'handler',
  'hatch',
  'hatchpath',
  'hkern',
  'iframe',
  'image',
  'linearGradient',
  'listener',
  'marker',
  'mask',
  'mesh',
  'meshgradient',
  'meshpatch',
  'meshrow',
  'metadata',
  'missing-glyph',
  'mpath',
  'pattern',
  'prefetch',
  'radialGradient',
  'script',
  'set',
  'solidColor',
  'solidcolor',
  'style',
  'svg',
  'switch',
  'symbol',
  'tbreak',
  'text',
  'textArea',
  'textPath',
  'title',
  'tref',
  'tspan',
  'unknown',
  'video',
  'view',
  'vkern'
].concat(VOID_SVG_TAGS_LIST)).sort();

/**
 * HTML void elements that cannot be auto-closed and shouldn't contain child nodes.
 * @type {Array}
 * @see   {@link http://www.w3.org/TR/html-markup/syntax.html#syntax-elements}
 * @see   {@link http://www.w3.org/TR/html5/syntax.html#void-elements}
 */
const VOID_HTML_TAGS_LIST = [
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

/**
 * List of all the html tags
 * @const {Array}
 * @see {@link https://github.com/sindresorhus/html-tags}
 */
const HTML_TAGS_LIST = uniq([
  'a',
  'abbr',
  'address',
  'article',
  'aside',
  'audio',
  'b',
  'bdi',
  'bdo',
  'blockquote',
  'body',
  'canvas',
  'caption',
  'cite',
  'code',
  'colgroup',
  'datalist',
  'dd',
  'del',
  'details',
  'dfn',
  'dialog',
  'div',
  'dl',
  'dt',
  'em',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hgroup',
  'html',
  'i',
  'iframe',
  'ins',
  'kbd',
  'label',
  'legend',
  'main',
  'map',
  'mark',
  'math',
  'menu',
  'nav',
  'noscript',
  'object',
  'ol',
  'optgroup',
  'p',
  'picture',
  'pre',
  'q',
  'rb',
  'rp',
  'rt',
  'rtc',
  'ruby',
  's',
  'samp',
  'script',
  'section',
  'select',
  'slot',
  'small',
  'span',
  'strong',
  'style',
  'sub',
  'summary',
  'sup',
  'svg',
  'table',
  'tbody',
  'td',
  'template',
  'tfoot',
  'th',
  'thead',
  'time',
  'title',
  'tr',
  'u',
  'ul',
  'var',
  'video'
]
  .concat(VOID_HTML_TAGS_LIST)
  .concat(HTML_ELEMENTS_HAVING_VALUE_ATTRIBUTE_LIST)
).sort();

/**
 * List of all boolean HTML attributes
 * @const {RegExp}
 * @see {@link https://www.w3.org/TR/html5/infrastructure.html#sec-boolean-attributes}
 */
const BOOLEAN_ATTRIBUTES_LIST = [
  'disabled',
  'visible',
  'checked',
  'readonly',
  'required',
  'allowfullscreen',
  'autofocus',
  'autoplay',
  'compact',
  'controls',
  'default',
  'formnovalidate',
  'hidden',
  'ismap',
  'itemscope',
  'loop',
  'multiple',
  'muted',
  'noresize',
  'noshade',
  'novalidate',
  'nowrap',
  'open',
  'reversed',
  'seamless',
  'selected',
  'sortable',
  'truespeed',
  'typemustmatch'
];

/**
 * Join a list of items with the pipe symbol (usefull for regex list concatenation)
 * @private
 * @param   {Array} list - list of strings
 * @returns {string} the list received joined with pipes
 */
function joinWithPipe(list) {
  return list.join('|')
}

/**
 * Convert list of strings to regex in order to test against it ignoring the cases
 * @private
 * @param   {...Array} lists - array of strings
 * @returns {RegExp} regex that will match all the strings in the array received ignoring the cases
 */
function listsToRegex(...lists) {
  return new RegExp(`^/?(?:${joinWithPipe(lists.map(joinWithPipe))})$`, 'i')
}

/**
 * Regex matching all the html tags ignoring the cases
 * @const {RegExp}
 */
const HTML_TAGS_RE = listsToRegex(HTML_TAGS_LIST);

/**
 * Regex matching all the svg tags ignoring the cases
 * @const {RegExp}
 */
const SVG_TAGS_RE = listsToRegex(SVG_TAGS_LIST);

/**
 * Regex matching all the void html tags ignoring the cases
 * @const {RegExp}
 */
const VOID_HTML_TAGS_RE =  listsToRegex(VOID_HTML_TAGS_LIST);

/**
 * Regex matching all the void svg tags ignoring the cases
 * @const {RegExp}
 */
const VOID_SVG_TAGS_RE =  listsToRegex(VOID_SVG_TAGS_LIST);

/**
 * Regex matching all the html tags where the value tag is allowed
 * @const {RegExp}
 */
const HTML_ELEMENTS_HAVING_VALUE_ATTRIBUTE_RE = listsToRegex(HTML_ELEMENTS_HAVING_VALUE_ATTRIBUTE_LIST);

/**
 * Regex matching all the boolean attributes
 * @const {RegExp}
 */
const BOOLEAN_ATTRIBUTES_RE =  listsToRegex(BOOLEAN_ATTRIBUTES_LIST);

/**
 * True if it's a self closing tag
 * @param   {string}  tag - test tag
 * @returns {boolean} true if void
 * @example
 * isVoid('meta') // true
 * isVoid('circle') // true
 * isVoid('IMG') // true
 * isVoid('div') // false
 * isVoid('mask') // false
 */
function isVoid(tag) {
  return [
    VOID_HTML_TAGS_RE,
    VOID_SVG_TAGS_RE
  ].some(r => r.test(tag))
}

/**
 * True if it's not SVG nor a HTML known tag
 * @param   {string}  tag - test tag
 * @returns {boolean} true if custom element
 * @example
 * isCustom('my-component') // true
 * isCustom('div') // false
 */
function isCustom(tag) {
  return [
    HTML_TAGS_RE,
    SVG_TAGS_RE
  ].every(l => !l.test(tag))
}

/**
 * True if it's a boolean attribute
 * @param   {string} attribute - test attribute
 * @returns {boolean} true if the attribute is a boolean type
 * @example
 * isBoolAttribute('selected') // true
 * isBoolAttribute('class') // false
 */
function isBoolAttribute(attribute) {
  return BOOLEAN_ATTRIBUTES_RE.test(attribute)
}

/**
 * Memoization function
 * @param   {Function} fn - function to memoize
 * @returns {*} return of the function to memoize
 */
function memoize(fn) {
  const cache = new WeakMap();

  return (...args) => {
    if (cache.has(args[0])) return cache.get(args[0])

    const ret = fn(...args);

    cache.set(args[0], ret);

    return ret
  }
}

const expressionsContentRe = memoize(brackets => RegExp(`(${brackets[0]}[^${brackets[1]}]*?${brackets[1]})`, 'g'));
const isSpreadAttribute = name => SPREAD_OPERATOR.test(name);
const isAttributeExpression = (name, brackets) => name[0] === brackets[0];
const getAttributeEnd = (state, attr) => expr(state, attr, '[>/\\s]', attr.start);

/**
 * The more complex parsing is for attributes as it can contain quoted or
 * unquoted values or expressions.
 *
 * @param   {ParserStore} state  - Parser state
 * @returns {number} New parser mode.
 * @private
 */
function attr(state) {
  const { data, last, pos, root } = state;
  const tag = last; // the last (current) tag in the output
  const _CH = /\S/g; // matches the first non-space char
  const ch = execFromPos(_CH, pos, data);

  switch (true) {
  case !ch:
    state.pos = data.length; // reaching the end of the buffer with
    // NodeTypes.ATTR will generate error
    break
  case ch[0] === '>':
    // closing char found. If this is a self-closing tag with the name of the
    // Root tag, we need decrement the counter as we are changing mode.
    state.pos = tag.end = _CH.lastIndex;
    if (tag[IS_SELF_CLOSING]) {
      state.scryle = null; // allow selfClosing script/style tags
      if (root && root.name === tag.name) {
        state.count--; // "pop" root tag
      }
    }
    return TEXT
  case ch[0] === '/':
    state.pos = _CH.lastIndex; // maybe. delegate the validation
    tag[IS_SELF_CLOSING] = true; // the next loop
    break
  default:
    delete tag[IS_SELF_CLOSING]; // ensure unmark as selfclosing tag
    setAttribute(state, ch.index, tag);
  }

  return ATTR
}

/**
 * Parses an attribute and its expressions.
 *
 * @param   {ParserStore}  state  - Parser state
 * @param   {number} pos    - Starting position of the attribute
 * @param   {Object} tag    - Current parent tag
 * @returns {undefined} void function
 * @private
 */
function setAttribute(state, pos, tag) {
  const { data } = state;
  const expressionContent = expressionsContentRe(state.options.brackets);
  const re = ATTR_START; // (\S[^>/=\s]*)(?:\s*=\s*([^>/])?)? g
  const start = re.lastIndex = expressionContent.lastIndex = pos; // first non-whitespace
  const attrMatches = re.exec(data);
  const isExpressionName = isAttributeExpression(attrMatches[1], state.options.brackets);
  const match = isExpressionName ? [null, expressionContent.exec(data)[1], null] : attrMatches;

  if (match) {
    const end = re.lastIndex;
    const attr = parseAttribute(state, match, start, end, isExpressionName);

    //assert(q && q.type === Mode.TAG, 'no previous tag for the attr!')
    // Pushes the attribute and shifts the `end` position of the tag (`last`).
    state.pos = tag.end = attr.end;
    tag.attributes = addToCollection(tag.attributes, attr);
  }
}

function parseNomalAttribute(state, attr, quote) {
  const { data } = state;
  let { end } = attr;

  if (isBoolAttribute(attr.name)) {
    attr[IS_BOOLEAN] = true;
  }

  // parse the whole value (if any) and get any expressions on it
  if (quote) {
    // Usually, the value's first char (`quote`) is a quote and the lastIndex
    // (`end`) is the start of the value.
    let valueStart = end;
    // If it not, this is an unquoted value and we need adjust the start.
    if (quote !== '"' && quote !== '\'') {
      quote = ''; // first char of value is not a quote
      valueStart--; // adjust the starting position
    }

    end = expr(state, attr, quote || '[>/\\s]', valueStart);

    // adjust the bounds of the value and save its content
    return Object.assign(attr, {
      value: getChunk(data, valueStart, end),
      valueStart,
      end: quote ? ++end : end
    })
  }

  return attr
}


/**
 * Parse expression names <a {href}>
 * @param   {ParserStore}  state  - Parser state
 * @param   {Object} attr - attribute object parsed
 * @returns {Object} normalized attribute object
 */
function parseSpreadAttribute(state, attr) {
  const end = getAttributeEnd(state, attr);

  return {
    [IS_SPREAD]: true,
    start: attr.start,
    expressions: attr.expressions.map(expr => Object.assign(expr, {
      text: expr.text.replace(SPREAD_OPERATOR, '').trim()
    })),
    end: end
  }
}

/**
 * Parse expression names <a {href}>
 * @param   {ParserStore}  state  - Parser state
 * @param   {Object} attr - attribute object parsed
 * @returns {Object} normalized attribute object
 */
function parseExpressionNameAttribute(state, attr) {
  const end = getAttributeEnd(state, attr);

  return {
    start: attr.start,
    name: attr.expressions[0].text.trim(),
    expressions: attr.expressions,
    end: end
  }
}

/**
 * Parse the attribute values normalising the quotes
 * @param   {ParserStore}  state  - Parser state
 * @param   {Array} match - results of the attributes regex
 * @param   {number} start - attribute start position
 * @param   {number} end - attribute end position
 * @param   {boolean} isExpressionName - true if the attribute name is an expression
 * @returns {Object} attribute object
 */
function parseAttribute(state, match, start, end, isExpressionName) {
  const attr = {
    name: match[1],
    value: '',
    start,
    end
  };

  const quote = match[2]; // first letter of value or nothing

  switch (true) {
  case isSpreadAttribute(attr.name):
    return parseSpreadAttribute(state, attr)
  case isExpressionName === true:
    return parseExpressionNameAttribute(state, attr)
  default:
    return parseNomalAttribute(state, attr, quote)
  }
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
 * Parses comments in long or short form
 * (any DOCTYPE & CDATA blocks are parsed as comments).
 *
 * @param   {ParserState} state  - Parser state
 * @param   {string} data       - Buffer to parse
 * @param   {number} start      - Position of the '<!' sequence
 * @returns {number} node type id
 * @private
 */
function comment(state, data, start) {
  const pos = start + 2; // skip '<!'
  const isLongComment = data.substr(pos, 2) === '--';
  const str = isLongComment ? '-->' : '>';
  const end = data.indexOf(str, pos);

  if (end < 0) {
    panic(data, unclosedComment, start);
  }

  pushComment(
    state,
    start,
    end + str.length,
    data.substring(start, end + str.length)
  );

  return TEXT
}

/**
 * Parse a comment.
 *
 * @param   {ParserState}  state - Current parser state
 * @param   {number}  start - Start position of the tag
 * @param   {number}  end   - Ending position (last char of the tag)
 * @param   {string}  text  - Comment content
 * @returns {undefined} void function
 * @private
 */
function pushComment(state, start, end, text) {
  state.pos = end;
  if (state.options.comments === true) {
    flush(state);
    state.last = {
      type: COMMENT,
      start,
      end,
      text
    };
  }
}

/**
 * Pushes a new *tag* and set `last` to this, so any attributes
 * will be included on this and shifts the `end`.
 *
 * @param   {ParserState} state  - Current parser state
 * @param   {string}  name      - Name of the node including any slash
 * @param   {number}  start     - Start position of the tag
 * @param   {number}  end       - Ending position (last char of the tag + 1)
 * @returns {undefined} - void function
 * @private
 */
function pushTag(state, name, start, end) {
  const root = state.root;
  const last = { type: TAG, name, start, end };

  if (isCustom(name)) {
    last[IS_CUSTOM] = true;
  }

  if (isVoid(name)) {
    last[IS_VOID] = true;
  }

  state.pos = end;

  if (root) {
    if (name === root.name) {
      state.count++;
    } else if (name === root.close) {
      state.count--;
    }
    flush(state);
  } else {
    // start with root (keep ref to output)
    state.root = { name: last.name, close: `/${name}` };
    state.count = 1;
  }

  state.last = last;
}

/**
 * Parse the tag following a '<' character, or delegate to other parser
 * if an invalid tag name is found.
 *
 * @param   {ParserState} state  - Parser state
 * @returns {number} New parser mode
 * @private
 */
function tag(state) {
  const { pos, data } = state; // pos of the char following '<'
  const start = pos - 1; // pos of '<'
  const str = data.substr(pos, 2); // first two chars following '<'

  switch (true) {
  case str[0] === '!':
    return comment(state, data, start)
  case TAG_2C.test(str):
    return parseTag(state, start)
  default:
    return pushText(state, start, pos) // pushes the '<' as text
  }
}

function parseTag(state, start) {
  const { data, pos } = state;
  const re = TAG_NAME; // (\/?[^\s>/]+)\s*(>)? g
  const match = execFromPos(re, pos, data);
  const end = re.lastIndex;
  const name = match[1].toLowerCase(); // $1: tag name including any '/'
  // script/style block is parsed as another tag to extract attributes
  if (name in RE_SCRYLE) {
    state.scryle = name; // used by parseText
  }

  pushTag(state, name, start, end);
  // only '>' can ends the tag here, the '/' is handled in parseAttribute
  if (!match[2]) {
    return ATTR
  }

  return TEXT
}

/**
 * Parses regular text and script/style blocks ...scryle for short :-)
 * (the content of script and style is text as well)
 *
 * @param   {ParserState} state - Parser state
 * @returns {number} New parser mode.
 * @private
 */
function text(state) {
  const { pos, data, scryle } = state;

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
    state.scryle = null; // reset the script/style flag now
    // write the tag content, if any
    if (start > pos) {
      parseSpecialTagsContent(state, name, match);
    }
    // now the closing tag, either </script> or </style>
    pushTag(state, `/${name}`, start, end);
    break
  }
  case data[pos] === '<':
    state.pos++;
    return TAG
  default:
    expr(state, null, '<', pos);
  }

  return TEXT
}

/**
 * Parse the text content depending on the name
 * @param   {ParserState} state - Parser state
 * @param   {string} name  - one of the tags matched by the RE_SCRYLE regex
 * @param   {Array}  match - result of the regex matching the content of the parsed tag
 * @returns {undefined} void function
 */
function parseSpecialTagsContent(state, name, match) {
  const { pos } = state;
  const start = match.index;

  if (name === TEXTAREA_TAG) {
    expr(state, null, match[0], pos);
  } else {
    pushText(state, pos, start);
  }
}

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

// check whether a tag has the 'src' attribute set like for example `<script src="">`
const hasSrcAttribute = node => (node.attributes || []).some(attr => attr.name === 'src');

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
    const store = this.store;
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
    const store = this.store;

    switch (node.type) {
    case COMMENT:
      this.pushComment(store, node);
      break
    case TEXT:
      this.pushText(store, node);
      break
    case TAG: {
      const name = node.name;
      const closingTagChar = '/';
      const [firstChar] = name;

      if (firstChar === closingTagChar && !node.isVoid) {
        this.closeTag(store, node, name);
      } else if (firstChar !== closingTagChar) {
        this.openTag(store, node);
      }
      break
    }
    }
  },
  pushComment(store, node) {
    const parent = store.last;

    parent.nodes.push(node);
  },
  closeTag(store, node) {
    const last = store.scryle || store.last;

    last.end = node.end;

    // update always the root node end position
    if (store.root.nodes[0]) store.root.nodes[0].end = node.end;

    if (store.scryle) {
      store.scryle = null;
    } else {
      store.last = store.stack.pop();
    }
  },

  openTag(store, node) {
    const name = node.name;
    const attrs = node.attributes;
    const isCoreTag = (JAVASCRIPT_TAG === name && !hasSrcAttribute(node) || name === STYLE_TAG);

    if (isCoreTag) {
      // Only accept one of each
      if (store[name]) {
        panic(this.store.data, duplicatedNamedTag.replace('%1', name), node.start);
      }

      store[name] = node;
      store.scryle = store[name];
    } else {
      // store.last holds the last tag pushed in the stack and this are
      // non-void, non-empty tags, so we are sure the `lastTag` here
      // have a `nodes` property.
      const lastTag = store.last;
      const newNode = node;

      lastTag.nodes.push(newNode);

      if (lastTag[IS_RAW] || RAW_TAGS.test(name)) {
        node[IS_RAW] = true;
      }

      if (!node[IS_SELF_CLOSING] && !node[IS_VOID]) {
        store.stack.push(lastTag);
        newNode.nodes = [];
        store.last = newNode;
      }
    }

    if (attrs) {
      this.attrs(attrs);
    }
  },
  attrs(attributes) {
    attributes.forEach(attr => {
      if (attr.value) {
        this.split(attr, attr.value, attr.valueStart, true);
      }
    });
  },
  pushText(store, node) {
    const text = node.text;
    const empty = !/\S/.test(text);
    const scryle = store.scryle;
    if (!scryle) {
      // store.last always have a nodes property
      const parent = store.last;

      const pack = this.compact && !parent[IS_RAW];
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

      expressions.forEach(expr => {
        const text = source.slice(pos, expr.start - start);
        const code = expr.text;
        parts.push(this.sanitise(node, text, pack), escapeReturn(escapeSlashes(code).trim()));
        pos = expr.end - start;
      });

      if (pos < node.end) {
        parts.push(this.sanitise(node, source.slice(pos), pack));
      }
    } else {
      parts[0] = this.sanitise(node, source, pack);
    }

    node.parts = parts.filter(p => p); // remove the empty strings
  },
  // unescape escaped brackets and split prefixes of expressions
  sanitise(node, text, pack) {
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

/**
 * Factory for the Parser class, exposing only the `parse` method.
 * The export adds the Parser class as property.
 *
 * @param   {Object}   options - User Options
 * @param   {Function} customBuilder - Tree builder factory
 * @returns {Function} Public Parser implementation.
 */
function parser(options, customBuilder) {
  const state = curry(createParserState)(options, customBuilder || createTreeBuilder);
  return {
    parse: (data) => parse(state(data))
  }
}

/**
 * Create a new state object
 * @param   {Object} userOptions - parser options
 * @param   {Function} builder - Tree builder factory
 * @param   {string} data - data to parse
 * @returns {ParserState} it represents the current parser state
 */
function createParserState(userOptions, builder, data) {
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
 * @param   {ParserState}  state - Current parser state
 * @returns {ParserResult} Result, contains data and output properties.
 */
function parse(state) {
  const { data } = state;

  walk(state);
  flush(state);

  if (state.count) {
    panic(data, state.count > 0 ? unexpectedEndOfFile : rootTagNotFound, state.pos);
  }

  return {
    data,
    output: state.builder.get()
  }
}

/**
 * Parser walking recursive function
 * @param {ParserState}  state - Current parser state
 * @param {string} type - current parsing context
 * @returns {undefined} void function
 */
function walk(state, type) {
  const { data } = state;
  // extend the state adding the tree builder instance and the initial data
  const length = data.length;

  // The "count" property is set to 1 when the first tag is found.
  // This becomes the root and precedent text or comments are discarded.
  // So, at the end of the parsing count must be zero.
  if (state.pos < length && state.count) {
    walk(state, eat(state, type));
  }
}

/**
 * Function to help iterating on the current parser state
 * @param {ParserState}  state - Current parser state
 * @param   {string} type - current parsing context
 * @returns {string} parsing context
 */
function eat(state, type) {
  switch (type) {
  case TAG:
    return tag(state)
  case ATTR:
    return attr(state)
  default:
    return text(state)
  }
}

/**
 * Expose the internal constants
 */
const constants = c;

/**
 * The nodeTypes definition
 */
const nodeTypes = types;

exports.constants = constants;
exports.default = parser;
exports.nodeTypes = nodeTypes;
