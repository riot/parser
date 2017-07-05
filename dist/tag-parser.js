'use strict';

var escapeStr = function (str) { return str.replace(/(?=[-[\](){^*+?.$|\\])/g, '\\'); };

const skipES6TL = require('./skip-es6-tl');

const skipRegex = require('skip-regex');

var exprExtr = (function (_skipES6TL, _skipRegex, _escapeStr) {
    var $_ES6_BQ = '`';
    var S_SQ_STR = /'[^'\n\r\\]*(?:\\(?:\r\n?|[\S\s])[^'\n\r\\]*)*'/.source;
    var S_STRING = S_SQ_STR + "|" + S_SQ_STR.replace(/'/g, '"');
    var reBr = {};
    function _regex(b) {
        var re = reBr[b];
        if (!re) {
            var s = _escapeStr(b);
            if (b.length > 1) {
                s = s + '|[';
            }
            else {
                s = /[\{}[\]()]/.test(b) ? '[' : "[" + s;
            }
            reBr[b] = re = new RegExp(S_STRING + "|" + s + "`/\\{}[\\]()]", 'g');
        }
        return re;
    }
    return function (code, start, bp) {
        var openingBraces = bp[0];
        var closingBraces = bp[1];
        var offset = start + openingBraces.length;
        var stack = [];
        var re = _regex(closingBraces);
        re.lastIndex = offset;
        var idx;
        var end;
        var str;
        var match;
        while ((match = re.exec(code))) {
            idx = match.index;
            end = re.lastIndex;
            str = match[0];
            if (str === closingBraces && !stack.length) {
                return {
                    text: code.slice(offset, idx),
                    start: start,
                    end: end,
                };
            }
            str = str[0];
            switch (str) {
                case '[':
                case '(':
                case '{':
                    stack.push(str === '[' ? ']' : str === '(' ? ')' : '}');
                    break;
                case ')':
                case ']':
                case '}':
                    if (str !== stack.pop()) {
                        throw new Error("Unexpected character '" + str + "'");
                    }
                    if (str === '}' && stack[stack.length - 1] === $_ES6_BQ) {
                        str = stack.pop();
                    }
                    end = idx + 1;
                    break;
                case '/':
                    end = _skipRegex(code, idx);
                    break;
            }
            if (str === $_ES6_BQ) {
                re.lastIndex = _skipES6TL(code, end, stack);
            }
            else {
                re.lastIndex = end;
            }
        }
        if (stack.length) {
            throw new Error('Unclosed expression.');
        }
        return null;
    };
})(skipES6TL, skipRegex, escapeStr);

var formatError = function (data, message, pos) {
    if (!pos) {
        pos = data.length;
    }
    var line = (data.slice(0, pos).match(/\r\n?|\n/g) || '').length + 1;
    var col = 0;
    while (--pos >= 0 && !/[\r\n]/.test(data[pos])) {
        ++col;
    }
    return "[" + line + "," + col + "]: " + message;
};

var MSG = {
    rootTagNotFound: 'Root tag not found.',
    unexpectedEndOfFile: 'Unexpected end of file.',
    unclosedComment: 'Unclosed comment.',
    unclosedNamedBlock: 'Unclosed "%1" block.',
    duplicatedNamedTag: 'Duplicate tag "<%1>".',
    expectedAndInsteadSaw: 'Expected "</%1>" and instead saw "<%2>".',
};

var TAG_2C = /^(?:\/[a-zA-Z]|[a-zA-Z][^\s>/]?)/;
var TAG_NAME = /(\/?[^\s>/]+)\s*(>)?/g;
var ATTR_START = /(\S[^>/=\s]*)(?:\s*=\s*([^>/])?)?/g;
var RE_SCRYLE = {
    script: /<\/script\s*>/gi,
    style: /<\/style\s*>/gi,
    textarea: /<\/textarea\s*>/gi,
};
var TagParser = (function () {
    function TagParser(builderFactory, options) {
        this.opts = options;
        this.bf = builderFactory;
        this.bp = options.brackets;
        this.cm = options.comments === true;
        this.re = {};
    }
    TagParser.prototype.parse = function (data, pos) {
        var me = this;
        var builder = me.bf(data, me.opts);
        var state = {
            pos: pos | 0,
            last: null,
            count: -1,
            scryle: null,
            builder: builder,
            data: data,
        };
        var length = data.length;
        var type = 3;
        while (state.pos < length && state.count) {
            if (type === 3           ) {
                type = me.text(state, data);
            }
            else if (type === 1          ) {
                type = me.tag(state, data);
            }
            else if (type === 2           ) {
                type = me.attr(state, data);
            }
        }
        me.flush(state);
        if (state.count) {
            me.err(data, state.count > 0
                ? MSG.unexpectedEndOfFile : MSG.rootTagNotFound, state.pos);
        }
        return { data: data, output: builder.get() };
    };
    TagParser.prototype.err = function (data, msg, pos) {
        var message = formatError(data, msg, pos);
        throw new Error(message);
    };
    TagParser.prototype.flush = function (state) {
        var last = state.last;
        state.last = null;
        if (last && state.root) {
            state.builder.push(last);
        }
    };
    TagParser.prototype.pushCmnt = function (state, start, end) {
        this.flush(state);
        state.pos = end;
        if (this.cm === true) {
            state.last = { type: 8              , start: start, end: end };
        }
    };
    TagParser.prototype.pushText = function (state, start, end, expr, rep) {
        var text = state.data.slice(start, end);
        var q = state.last;
        state.pos = end;
        if (q && q.type === 3           ) {
            q.text += text;
            q.end = end;
        }
        else {
            this.flush(state);
            state.last = q = { type: 3           , text: text, start: start, end: end };
        }
        if (expr) {
            q.expr = (q.expr || []).concat(expr);
        }
        if (rep) {
            q.unescape = rep;
        }
    };
    TagParser.prototype.pushTag = function (state, name, start, end) {
        var root = state.root;
        var last = { type: 1          , name: name, start: start, end: end };
        state.pos = end;
        if (root) {
            if (name === root.name) {
                state.count++;
            }
            else if (name === root.close) {
                state.count--;
            }
            this.flush(state);
        }
        else {
            state.root = { name: last.name, close: "/" + name };
            state.count = 1;
        }
        state.last = last;
    };
    TagParser.prototype.tag = function (state, data) {
        var pos = state.pos;
        var start = pos - 1;
        var str = data.substr(pos, 2);
        if (str[0] === '!') {
            this.cmnt(state, data, start);
        }
        else if (TAG_2C.test(str)) {
            var re = TAG_NAME;
            re.lastIndex = pos;
            var match = re.exec(data);
            var end = re.lastIndex;
            var name_1 = match[1].toLowerCase();
            if (name_1 in RE_SCRYLE) {
                state.scryle = name_1;
            }
            this.pushTag(state, name_1, start, end);
            if (!match[2]) {
                return 2           ;
            }
        }
        else {
            this.pushText(state, start, pos);
        }
        return 3           ;
    };
    TagParser.prototype.cmnt = function (state, data, start) {
        var pos = start + 2;
        var str = data.substr(pos, 2) === '--' ? '-->' : '>';
        var end = data.indexOf(str, pos);
        if (end < 0) {
            this.err(data, MSG.unclosedComment, start);
        }
        this.pushCmnt(state, start, end + str.length);
    };
    TagParser.prototype.attr = function (state, data) {
        var tag = state.last;
        var _CH = /\S/g;
        _CH.lastIndex = state.pos;
        var ch = _CH.exec(data);
        if (!ch) {
            state.pos = data.length;
        }
        else if (ch[0] === '>') {
            state.pos = tag.end = _CH.lastIndex;
            if (tag.selfclose) {
                state.scryle = null;
                if (state.root && state.root.name === tag.name) {
                    state.count--;
                }
            }
            return 3           ;
        }
        else if (ch[0] === '/') {
            state.pos = _CH.lastIndex;
            tag.selfclose = true;
        }
        else {
            delete tag.selfclose;
            this.setAttr(state, data, ch.index, tag);
        }
        return 2           ;
    };
    TagParser.prototype.setAttr = function (state, data, pos, tag) {
        var re = ATTR_START;
        var start = re.lastIndex = pos;
        var match = re.exec(data);
        if (!match) {
            return;
        }
        var end = re.lastIndex;
        var quote = match[2];
        var attr = { name: match[1].toLowerCase(), value: '', start: start, end: end };
        if (quote) {
            var valueStart = end;
            if (quote !== '"' && quote !== "'") {
                quote = '';
                valueStart--;
            }
            end = this.expr(state, data, attr, quote || '[>/\\s]', valueStart);
            attr.value = data.slice(valueStart, end);
            attr.valueStart = valueStart;
            attr.end = quote ? ++end : end;
        }
        state.pos = tag.end = end;
        (tag.attr || (tag.attr = [])).push(attr);
    };
    TagParser.prototype.text = function (state, data) {
        var me = this;
        var pos = state.pos;
        if (state.scryle) {
            var name_2 = state.scryle;
            var re = RE_SCRYLE[name_2];
            re.lastIndex = pos;
            var match = re.exec(data);
            if (!match) {
                me.err(data, MSG.unclosedNamedBlock.replace('%1', name_2), pos - 1);
            }
            var start = match.index;
            var end = re.lastIndex;
            state.scryle = null;
            if (start > pos) {
                if (name_2 === 'textarea') {
                    this.expr(state, data, null, match[0], pos);
                }
                else {
                    me.pushText(state, pos, start);
                }
            }
            me.pushTag(state, "/" + name_2, start, end);
        }
        else if (data[pos] === '<') {
            state.pos++;
            return 1          ;
        }
        else {
            this.expr(state, data, null, '<', pos);
        }
        return 3           ;
    };
    TagParser.prototype.expr = function (state, data, node, endingChars, pos) {
        var me = this;
        var start = pos;
        var expr;
        var unescape = '';
        var re = me.b0re(endingChars);
        var match;
        re.lastIndex = pos;
        while ((match = re.exec(data)) && !match[1]) {
            pos = match.index;
            if (data[pos - 1] === '\\') {
                unescape = match[0];
            }
            else {
                var tmpExpr = exprExtr(data, pos, me.bp);
                if (tmpExpr) {
                    (expr || (expr = [])).push(tmpExpr);
                    re.lastIndex = tmpExpr.end;
                }
            }
        }
        if (!match) {
            me.err(data, MSG.unexpectedEndOfFile, pos);
        }
        var end = match.index;
        if (node) {
            if (unescape) {
                node.unescape = unescape;
            }
            if (expr) {
                node.expr = expr;
            }
        }
        else {
            me.pushText(state, start, end, expr, unescape);
        }
        return end;
    };
    TagParser.prototype.b0re = function (str) {
        var re = this.re[str];
        if (!re) {
            var b0 = escapeStr(this.bp[0]);
            this.re[str] = re = new RegExp("(" + str + ")|" + b0, 'g');
        }
        return re;
    };
    return TagParser;
}());

var voidTags = {
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
        'wbr',
    ],
    svg: [
        'circle',
        'ellipse',
        'line',
        'path',
        'polygon',
        'polyline',
        'rect',
        'stop',
        'use',
    ],
};

var SVG_NS = 'http://www.w3.org/2000/svg';
var RAW_TAGS = /^\/?(?:pre|textarea)$/;
var TreeBuilder = (function () {
    function TreeBuilder(data, options) {
        var root = {
            type: 1          ,
            name: '',
            start: 0,
            end: 0,
            nodes: [],
        };
        this.compact = options.compact !== false;
        this.prefixes = '^?=';
        this.state = {
            last: root,
            stack: [],
            scryle: null,
            root: root,
            style: null,
            script: null,
            data: data,
        };
    }
    TreeBuilder.prototype.get = function () {
        var state = this.state;
        return {
            html: state.root.nodes[0],
            css: state.style,
            js: state.script,
        };
    };
    TreeBuilder.prototype.push = function (node) {
        var state = this.state;
        if (node.type === 3           ) {
            this.pushText(state, node);
        }
        else if (node.type === 1          ) {
            var name_1 = node.name;
            if (name_1[0] === '/') {
                this.closeTag(state, node, name_1);
            }
            else {
                this.openTag(state, node);
            }
        }
    };
    TreeBuilder.prototype.err = function (msg, pos) {
        var message = formatError(this.state.data, msg, pos);
        throw new Error(message);
    };
    TreeBuilder.prototype.closeTag = function (state, node, name) {
        var last = state.scryle || state.last;
        var expected = last.name;
        if (expected !== name.slice(1)) {
            var msg = MSG.expectedAndInsteadSaw.replace('%1', expected).replace('%2', name);
            this.err(msg, last.start);
        }
        last.end = node.end;
        if (state.scryle) {
            state.scryle = null;
        }
        else {
            if (!state.stack[0]) {
                this.err('Stack is empty.', last.start);
            }
            state.last = state.stack.pop();
        }
    };
    TreeBuilder.prototype.openTag = function (state, node) {
        var name = node.name;
        var atrrs = node.attr;
        if (name === 'style' ||
            name === 'script' && !this.deferred(node, atrrs)) {
            if (state[name]) {
                this.err(MSG.duplicatedNamedTag.replace('%1', name), node.start);
            }
            state[name] = node;
            if (!node.selfclose) {
                state.scryle = state[name];
            }
        }
        else {
            var lastTag = state.last;
            var newNode = node;
            lastTag.nodes.push(newNode);
            if (lastTag.raw || RAW_TAGS.test(name)) {
                newNode.raw = true;
            }
            var voids = void 0;
            if (lastTag.ns || name === 'svg') {
                newNode.ns = SVG_NS;
                voids = voidTags.svg;
            }
            else {
                voids = voidTags.html;
            }
            if (~voids.indexOf(name)) {
                newNode.void = true;
            }
            else if (!node.selfclose) {
                state.stack.push(lastTag);
                newNode.nodes = [];
                state.last = newNode;
            }
        }
        if (atrrs) {
            this.attrs(atrrs);
        }
    };
    TreeBuilder.prototype.deferred = function (node, attributes) {
        if (attributes) {
            for (var i = 0; i < attributes.length; i++) {
                if (attributes[i].name === 'defer') {
                    attributes.splice(i, 1);
                    return true;
                }
            }
        }
        return false;
    };
    TreeBuilder.prototype.attrs = function (attributes) {
        for (var i = 0; i < attributes.length; i++) {
            var attr = attributes[i];
            if (attr.value) {
                this.split(attr, attr.value, attr.valueStart, true);
            }
        }
    };
    TreeBuilder.prototype.pushText = function (state, node) {
        var text = node.text;
        var empty = !/\S/.test(text);
        var scryle = state.scryle;
        if (!scryle) {
            var parent_1 = state.last;
            var pack = this.compact && !parent_1.raw;
            if (pack && empty) {
                return;
            }
            this.split(node, text, node.start, pack);
            parent_1.nodes.push(node);
        }
        else if (!empty) {
            scryle.text = node;
        }
    };
    TreeBuilder.prototype.split = function (node, source, start, pack) {
        var expressions = node.expr;
        var parts = [];
        if (expressions) {
            var pos = 0;
            for (var i = 0; i < expressions.length; i++) {
                var expr = expressions[i];
                var text = source.slice(pos, expr.start - start);
                var code = expr.text;
                if (~this.prefixes.indexOf(code[0])) {
                    expr.prefix = code[0];
                    code = code.substr(1);
                }
                parts.push(this._tt(node, text, pack), code.replace(/\\/g, '\\\\').trim().replace(/\r/g, '\\r').replace(/\n/g, '\\n'));
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
    };
    TreeBuilder.prototype._tt = function (node, text, pack) {
        var rep = node.unescape;
        if (rep) {
            var idx = 0;
            rep = "\\" + rep;
            while (~(idx = text.indexOf(rep, idx))) {
                text = text.substr(0, idx) + text.substr(idx + 1);
                idx++;
            }
        }
        text = text.replace(/\\/g, '\\\\');
        return pack ? text.replace(/\s+/, ' ') : text.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
    };
    return TreeBuilder;
}());
function treeBuilder(data, options) {
    return new TreeBuilder(data, options || {});
}

function tagParser(options, tbf) {
    return new TagParser(tbf || treeBuilder, options);
}

module.exports = tagParser;
