'use strict';

if (typeof Object.assign != 'function') {
  Object.defineProperty(Object, 'assign', {
    configurable: true,
    writable: true,
    value: function (dest) {
      if (dest == null) {
        throw new TypeError('Cannot convert dest to object')
      }
      var arg = arguments;

      dest = Object(dest);
      for (var ix = 1; ix < arg.length; ix++) {
        var src = arg[ix];
        if (src != null) {
          var k, key, keys = Object.keys(Object(src));
          for (k = 0; k < keys.length; k++) {
            key = keys[k];
            dest[key] = src[key];
          }
        }
      }
      return dest
    }
  });
}

var assign = Object.assign;

var beforeReChars = '[{(,;:?=|&!^~>%*/';

var beforeReWords = [
  'case',
  'default',
  'do',
  'else',
  'in',
  'return',
  'typeof',
  'void',
  'yield'
];

var wordsLastChar = beforeReWords.reduce(function (s, w) { return s + w.slice(-1); }, '');

var RE_REGEX = /^\/(?=[^*>/])[^[/\\]*(?:(?:\\.|\[(?:\\.|[^\]\\]*)*\])[^[\\/]*)*?\/[gimuy]*/;

var RE_VN_CHAR = /[$\w]/;

function prev(code, pos) {
  while (--pos >= 0 && /\s/.test(code[pos])){  }
  return pos
}

function skipRegex(code, start) {

  var re = /.*/g;
  var pos = re.lastIndex = start - 1;
  var match = re.exec(code)[0].match(RE_REGEX);

  if (match) {
    var next = pos + match[0].length;

    pos = prev(code, pos);
    var c = code[pos];

    if (pos < 0 || ~beforeReChars.indexOf(c)) {
      return next
    }

    if (c === '.') {

      if (code[pos - 1] === '.') {
        start = next;
      }

    } else if (c === '+' || c === '-') {

      if (code[--pos] !== c ||
          (pos = prev(code, pos)) < 0 ||
          !RE_VN_CHAR.test(code[pos])) {
        start = next;
      }

    } else if (~wordsLastChar.indexOf(c)) {

      var end = pos + 1;

      while (--pos >= 0 && RE_VN_CHAR.test(code[pos])){  }
      if (~beforeReWords.indexOf(code.slice(pos + 1, end))) {
        start = next;
      }
    }
  }

  return start
}

var S_SQ_STR = /'[^'\n\r\\]*(?:\\(?:\r\n?|[\S\s])[^'\n\r\\]*)*'/.source;
var S_STRING = S_SQ_STR + "|" + (S_SQ_STR.replace(/'/g, '"'));

function ExprExtractor(options) {
  this._bp   = options.brackets;
  this._re   = new RegExp((S_STRING + "|" + (this._reChar(this._bp[1]))), 'g');
  this.parse = this.parse.bind(this);
}

ExprExtractor.prototype = {

  parse: function parse(code, start) {
    var this$1 = this;

    var bp = this._bp;
    var re = this._re;

    if (code[start - 1] === '\\') {
      return bp[0]
    }

    var closingStr = bp[1];
    var offset = start + bp[0].length;
    var stack = [];

    var match, ch;

    re.lastIndex = offset;

    while ((match = re.exec(code))) {
      var end = re.lastIndex;
      var str = match[0];

      if (str === closingStr) {
        if (!stack.length) {
          return {
            text: code.slice(offset, match.index),
            start: start,
            end: end
          }
        }
        if (/[\])}]/.test(str[0])) {
          str = str[0];
          re.lastIndex = match.index + 1;
        }
      }

      switch (str) {
        case '[':
        case '(':
        case '{':
          stack.push(str === '[' ? ']' : str === '(' ? ')' : '}');
          break

        case ')':
        case ']':
        case '}':
          ch = stack.pop();
          if (ch !== str) { throw new Error(("Expected '" + ch + "' but got '" + str + "'")) }
          break

        case '`':
          re.lastIndex = this$1.skipES6str(code, end, stack);
          break

        case '/':
          re.lastIndex = this$1.skipRegex(code, end);
          break

        default:

          if (stack[stack.length - 1] === 1) {
            re.lastIndex = match.index + 1;
          }
          break
      }
    }

    return null
  },

  skipRegex: skipRegex,

  skipES6str: function skipES6str(code, start, stack) {

    if (stack.length && stack[stack.length - 1] === 1) {
      stack.pop();
      return start
    }

    var re = /[`$\\]/g;

    re.lastIndex = start;
    while (re.exec(code)) {
      var end = re.lastIndex;
      var c = code[end - 1];

      if (c === '`') {
        return end
      }
      if (c === '$' && code[end] === '{') {
        stack.push(1, '}');
        return end + 1
      }

    }

    throw new Error('Unclosed ES6 template')
  },

  _reChar: function _reChar(c) {
    var s;
    if (c.length === 1) {
      if (/[\{}[\]()]/.test(c)) { c = ''; }
      else if (c === '-') { c = "\\" + c; }
      s = '[`' + c + '/\\{}[\\]()]';
    } else {
      s = c.replace(/(?=[[^()\-*+?.$|])/g, '\\') + '|[`/\\{}[\\]()]';
    }
    return s
  }
};

function extractExpr(options) {
  return new ExprExtractor(options).parse
}

var TAG_2C = /^(?:\/[a-zA-Z>]|[a-zA-Z][^\s>/]?)/;

var TAG_NAME = /\/(>)|(\/?[^\s>/]+)\s*(>)?/g;

var ATTR_START = /(\S[^>/=\s]*)(?:\s*=\s*([^>/])?)?/g;

var RE_SCRYLE = {
  script: /<\/script\s*>/gi,
  style: /<\/style\s*>/gi,
};

function TagParser(options) {

  this.options = assign({
    comments: false,
    brackets: ['{', '}']
  }, options);

  this.extractExpr = extractExpr(this.options);
  this.parse = this._parse.bind(this);
  this._re = {};
}

assign(TagParser.prototype, {

  nodeTypes: {
    TAG:      1,
    ATTR:     2,
    TEXT:     3,
    COMMENT:  8,
    EXPR:     32
  },

  _parse: function _parse(data) {
    var this$1 = this;

    var state = {
      pos: 0,
      last: null,
      count: -1,
      output: []
    };

    var length = data.length;
    var type = 3;

    while (state.pos < length && state.count) {

      if (type === 3) {
        type = this$1.text(state, data);

      } else if (type === 1) {
        type = this$1.tag(state, data);

      } else if (type === 2) {
        type = this$1.attr(state, data);

      }
    }

    if (state.count) {
      this._err(state, data, ~state.count ? 'Unexpected end of file.' : 'Root tag not found.');
    }

    return { data: data, output: state.output }
  },

  error: function error(state, loc, message) {
    throw new Error(("[" + (loc.line) + "," + (loc.col) + "]: " + message))
  },

  _err: function _err(state, data, msg, pos) {
    if (pos == null) { pos = state.pos; }

    var line = (data.slice(0, pos).match(/\r\n?|\n/g) || '').length + 1;

    var col = 0;
    while (--pos >= 0 && !/[\r\n]/.test(data[pos])) {
      ++col;
    }

    state.data = data;
    this.error(state, { line: line, col: col }, msg);
  },

  _b0re: function _b0re(str) {
    var re = this._re[str];
    if (!re) {
      var b0 = this.options.brackets[0].replace(/(?=[[^()\-*+?.$|])/g, '\\');
      this._re[str] = re = new RegExp((str + "|" + b0), 'g');
    }
    return re
  },

  newNode: function newNode(type, name, start, end) {
    var node = { type: type, start: start, end: end };

    if (name) {
      node.name = name;
    }

    return node
  },

  pushComment: function pushComment(state, start, end) {
    state.last = null;
    state.pos  = end;
    if (this.options.comments) {
      state.output.push(this.newNode(8, null, start, end));
    }
  },

  pushText: function pushText(state, start, end, expr, rep) {
    var q = state.last;

    state.pos = end;

    if (q && q.type === 3) {
      q.end = end;
    } else {
      state.last = q = this.newNode(3, null, start, end);
      state.output.push(q);
    }

    if (expr && expr.length) {
      q.expressions = q.expressions ? q.expressions.concat(expr) : expr;
    }

    if (rep) {
      q.replace = rep;
    }
  },

  pushTag: function pushTag(state, type, name, start, end) {
    var root = state.root;
    var last = state.last = this.newNode(type, name, start, end);

    state.pos = end;

    if (root) {
      if (name === root.name) {
        state.count++;
      } else if (name === root.close) {
        state.count--;
      }
    } else {

      state.root  = { name: last.name, close: ("/" + name) };
      state.count = 1;
      state.output.length  = 0;
    }

    state.output.push(last);
  },

  pushAttr: function pushAttr(state, attr) {
    var q = state.last;

    state.pos = q.end = attr.end

    ;(q.attributes || (q.attributes = [])).push(attr);
  },

  tag: function tag(state, data) {
    var pos   = state.pos;
    var start = pos - 1;
    var str   = data.substr(pos, 2);

    if (str[0] === '!') {
      this.comment(state, data, start);

    } else if (TAG_2C.test(str)) {
      var re = TAG_NAME;
      re.lastIndex = pos;
      var match = re.exec(data);
      var end   = re.lastIndex;
      var hack  = match[1];
      var name  = hack ? 'script' : match[2].toLowerCase();

      if (name === 'script' || name === 'style') {
        state.scryle = name;
        state.hack = hack && RegExp(("<" + (state.root.close) + "\\s*>"), 'i');
      }

      this.pushTag(state, 1, name, start, end);

      if (!hack && match[3] !== '>') {
        return 2
      }

    } else {
      this.pushText(state, start, pos);
    }

    return 3
  },

  comment: function comment(state, data, start) {
    var pos = start + 2;
    var str = data.substr(pos, 2) === '--' ? '-->' : '>';
    var end = data.indexOf(str, pos);

    if (end < 0) {
      this._err(state, data, 'Unclosed comment', start);
    }

    this.pushComment(state, start, end + str.length);
  },

  attr: function attr(state, data) {
    var tag = state.last;
    var _CH = /\S/g;

    _CH.lastIndex = state.pos;
    var match = _CH.exec(data);

    if (!match) {
      state.pos = data.length;

    } else if (match[0] === '>') {

      state.pos = tag.end = _CH.lastIndex;
      if (tag.selfclose && state.root.name === tag.name) {
        state.count--;
      }

      return 3

    } else if (match[0] === '/') {
      state.pos = _CH.lastIndex;
      tag.selfclose = true;

    } else {
      delete tag.selfclose;

      var re    = ATTR_START;
      var start = re.lastIndex = match.index;
      match       = re.exec(data);
      var end   = re.lastIndex;
      var value = match[2] || '';

      var attr  = { name: match[1].toLowerCase(), value: value, start: start, end: end };

      if (value) {

        this.parseValue(state, data, attr, value, end);
      }

      this.pushAttr(state, attr);
    }

    return 2
  },

  parseValue: function parseValue(state, data, attr, quote, start) {
    var this$1 = this;

    if (quote !== '"' && quote !== "'") {
      quote = '';
      start--;
    }

    var re = this._b0re(("(" + (quote || '[>/\\s]') + ")"));
    var expr = [];
    var mm, tmp;

    re.lastIndex = start;
    while ((mm = re.exec(data)) && !mm[1]) {
      tmp = this$1.extractExpr(data, mm.index);
      if (tmp) {
        if (typeof tmp == 'string') {
          attr.replace = tmp;
        } else {
          expr.push(tmp);
          re.lastIndex = tmp.end;
        }
      }
    }

    if (!mm) {
      this._err(state, data, 'Unfinished attribute', start);
    }

    var end = mm.index;

    attr.value = data.slice(start, end);
    attr.valueStart = start;
    attr.end = quote ? end + 1 : end;

    if (expr.length) {
      attr.expressions = expr;
    }
  },

  text: function text(state, data) {
    var me = this;
    var pos = state.pos;

    if (state.scryle) {
      var name = state.scryle;
      var re   = state.hack || RE_SCRYLE[name];

      re.lastIndex = pos;
      var match = re.exec(data);
      if (!match) {
        me._err(state, data, ("Unclosed \"" + name + "\" block"), pos - 1);
      }
      var start = match.index;
      var end   = state.hack ? start : re.lastIndex;

      state.hack = state.scryle = 0;

      if (start > pos) {
        me.pushText(state, pos, start);
      }

      me.pushTag(state, 1, ("/" + name), start, end);

    } else if (data[pos] === '<') {
      state.pos++;

      return 1

    } else {
      var re$1 = me._b0re('<');
      var mm;
      var expr;
      var rep;

      re$1.lastIndex = pos;
      while ((mm = re$1.exec(data)) && mm[0] !== '<') {
        var tmp = me.extractExpr(data, mm.index);

        if (tmp) {
          if (typeof tmp == 'string') {
            rep = tmp;
          } else {
            (expr || (expr = [])).push(tmp);
            re$1.lastIndex = tmp.end;
          }
        }
      }

      var end$1 = mm ? mm.index : data.length;
      me.pushText(state, pos, end$1, expr, rep);
    }

    return 3
  }

});

function tagParser(options) {
  return new TagParser(options)
}

module.exports = tagParser;
//# sourceMappingURL=tag-parser.js.map
