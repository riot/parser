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
 * Selfclosing and void tags has no children[] property.
 */
import formatError from './format-error';
import MSG from './messages';
import voidTags from './void-tags';
// Do not touch text content inside this tags
var RAW_TAGS = /^\/?(?:pre|textarea)$/;
// Class htmlBuilder ======================================
var TreeBuilder = (function () {
    // This get the option `whitespace` to preserve spaces
    // and the compact `option` to strip empty text nodes
    function TreeBuilder(data, options) {
        var root = {
            type: 1 /* TAG */,
            name: '',
            start: 0,
            end: 0,
            children: [],
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
        // The real root tag is in state.root.children[0]
        return {
            html: state.root.children[0],
            css: state.style,
            js: state.script,
        };
    };
    /**
     * Process the current tag or text.
     *
     * @param {Object} node - Raw pseudo-node from the parser
     */
    TreeBuilder.prototype.push = function (node) {
        var state = this.state;
        if (node.type === 3 /* TEXT */) {
            this.pushText(state, node);
        }
        else if (node.type === 1 /* TAG */) {
            var name_1 = node.name;
            if (name_1[0] === '/') {
                this.closeTag(state, node, name_1);
            }
            else {
                this.openTag(state, node);
            }
        }
    };
    /**
     * Custom error handler can be implemented replacing this method.
     * The `state` object includes the buffer (`data`)
     * The error position (`loc`) contains line (base 1) and col (base 0).
     *
     * @param {string} msg   - Error message
     * @param {pos} [number] - Position of the error
     */
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
            // only one of both script and style tags
            if (state[name]) {
                this.err(MSG.duplicatedNamedTag.replace('%1', name), node.start);
            }
            state[name] = node;
            // support selfclosing script (w/o text content)
            if (!node.selfclose) {
                state.scryle = state[name];
            }
        }
        else {
            // state.last holds the last tag pushed in the stack and this are
            // non-void, non-empty tags, so we are sure the `lastTag` here
            // have a `children` property.
            var lastTag = state.last;
            var newNode = node;
            // lastTah have a children property
            lastTag.children.push(newNode);
            if (lastTag.raw || RAW_TAGS.test(name)) {
                newNode.raw = true;
            }
            var voids = void 0;
            if (lastTag.ns || name === 'svg') {
                newNode.ns = 'svg';
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
                newNode.children = [];
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
            // state.last always have a children property
            var parent_1 = state.last;
            var pack = this.compact && !parent_1.raw;
            if (pack && empty) {
                return;
            }
            this.split(node, text, node.start, pack);
            parent_1.children.push(node);
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
    // unescape escaped brackets and split prefixes of expressions
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
export default function treeBuilder(data, options) {
    return new TreeBuilder(data, options || {});
}
