/* ====================================================================
 * The Riot Tag Parser
 */
import escapeStr from './escape-str';
import exprExtr from './expr-extr';
import formatError from './format-error';
import MSG from './messages';
// --------------------------------------------------------------------
// Closure data and functions
//
/**
 * Matches the start of valid tags names; used with the first 2 chars after the `'<'`.
 * @const
 * @private
 */
var TAG_2C = /^(?:\/[a-zA-Z]|[a-zA-Z][^\s>/]?)/;
/**
 * Matches valid tags names AFTER the validation with `TAG_2C`.
 * $1: tag name including any `'/'`, $2: non self-closing brace (`>`) w/o attributes.
 * @const
 * @private
 */
var TAG_NAME = /(\/?[^\s>/]+)\s*(>)?/g;
/**
 * Matches an attribute name-value pair (both can be empty).
 * $1: attribute name, $2: value including any quotes.
 * @const
 * @private
 */
var ATTR_START = /(\S[^>/=\s]*)(?:\s*=\s*([^>/])?)?/g;
/**
 * Matches the closing tag of a `script` and `style` block.
 * Used by parseText fo find the end of the block.
 * @const
 * @private
 */
var RE_SCRYLE = {
    script: /<\/script\s*>/gi,
    style: /<\/style\s*>/gi,
};
// --------------------------------------------------------------------
// The TagParser class
//
/**
 * @class
 * @implements {IParser}
 */
var TagParser = (function () {
    /**
     * @param {Function} builderFactory - Factory function for the builder
     * @param {Object} options - User options
     */
    function TagParser(builderFactory, options) {
        this.opts = options;
        this.bf = builderFactory;
        this.bp = options.brackets;
        this.cm = options.comments === true;
        this.re = {};
    }
    // ------------------------------------------------------------------
    // Methods
    /**
     * It creates a raw output of pseudo-nodes with one of three different types,
     * all of them having a start/end position:
     *
     * - TAG     -- Opening or closing tags
     * - TEXT    -- Raw text
     * - COMMENT -- Comments
     *
     * @param   {string} data - HTML markup
     * @param   {number} pos  - Position where to start the parsing
     * @returns {ParserResult} Result, contains data and output properties.
     */
    TagParser.prototype.parse = function (data, pos) {
        var me = this;
        var builder = me.bf(data, me.opts);
        // Creating the state in the closure and passing it as a parameter is more
        // efficient and allows to use the same parser instance asynchronously.
        var state = {
            pos: pos | 0,
            last: null,
            count: -1,
            scryle: null,
            builder: builder,
            data: data,
        };
        var length = data.length;
        var type = 3 /* TEXT */;
        // The "count" property is set to 1 when the first tag is found.
        // This becomes the root and precedent text or comments are discarded.
        // So, at the end of the parsing count must be zero.
        while (state.pos < length && state.count) {
            if (type === 3 /* TEXT */) {
                type = me.text(state, data);
            }
            else if (type === 1 /* TAG */) {
                type = me.tag(state, data);
            }
            else if (type === 2 /* ATTR */) {
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
    /**
     * Custom error handler can replace this method.
     * The `state` object includes the buffer (`data`)
     * The error position (`loc`) contains line (base 1) and col (base 0).
     *
     * @param {string} source   - Processing buffer
     * @param {string} message  - Error message
     * @param {number} pos    - Error position
     * @private
     */
    TagParser.prototype.err = function (data, msg, pos) {
        var message = formatError(data, msg, pos);
        throw new Error(message);
    };
    /**
     * Outputs the last parsed node. Can be used with a builder too.
     *
     * @param {ParseState} state - Parsing state
     * @private
     */
    TagParser.prototype.flush = function (state) {
        var last = state.last;
        state.last = null;
        if (last && state.root) {
            state.builder.push(last);
        }
    };
    /**
     * Stores a comment.
     *
     * @param {ParseState}  state - Current parser state
     * @param {number}  start - Start position of the tag
     * @param {number}  end   - Ending position (last char of the tag)
     * @private
     */
    TagParser.prototype.pushCmnt = function (state, start, end) {
        this.flush(state);
        state.pos = end;
        if (this.cm === true) {
            state.last = { type: 8 /* COMMENT */, start: start, end: end };
        }
    };
    /**
     * Stores text in the last text node, or creates a new one if needed.
     *
     * @param {ParseState}   state   - Current parser state
     * @param {number}  start   - Start position of the tag
     * @param {number}  end     - Ending position (last char of the tag)
     * @param {RawExpr[]} [expr]  - Found expressions
     * @param {string}  [rep]   - Brackets to unescape
     * @private
     */
    TagParser.prototype.pushText = function (state, start, end, expr, rep) {
        var text = state.data.slice(start, end);
        var q = state.last;
        state.pos = end;
        if (q && q.type === 3 /* TEXT */) {
            q.text += text;
            q.end = end;
        }
        else {
            this.flush(state);
            state.last = q = { type: 3 /* TEXT */, text: text, start: start, end: end };
        }
        if (expr) {
            q.expr = (q.expr || []).concat(expr);
        }
        if (rep) {
            q.unescape = rep;
        }
    };
    /**
     * Pushes a new *tag* and set `last` to this, so any attributes
     * will be included on this and shifts the `end`.
     *
     * @param {ParseState} state  - Current parser state
     * @param {string}  name      - Name of the node including any slash
     * @param {number}  start     - Start position of the tag
     * @param {number}  end       - Ending position (last char of the tag + 1)
     * @private
     */
    TagParser.prototype.pushTag = function (state, name, start, end) {
        var root = state.root;
        var last = { type: 1 /* TAG */, name: name, start: start, end: end };
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
            // start with root (keep ref to output)
            state.root = { name: last.name, close: "/" + name };
            state.count = 1;
        }
        state.last = last;
    };
    /**
     * Parse the tag following a '<' character, or delegate to other parser
     * if an invalid tag name is found.
     *
     * @param   {ParseState} state  - Parser state
     * @param   {string} data       - Buffer to parse
     * @returns {number} New parser mode
     * @private
     */
    TagParser.prototype.tag = function (state, data) {
        var pos = state.pos; // pos of the char following '<'
        var start = pos - 1; // pos of '<'
        var str = data.substr(pos, 2); // first two chars following '<'
        if (str[0] === '!') {
            this.cmnt(state, data, start);
        }
        else if (TAG_2C.test(str)) {
            var re = TAG_NAME; // (\/?[^\s>/]+)\s*(>)? g
            re.lastIndex = pos;
            var match = re.exec(data);
            var end = re.lastIndex;
            var name_1 = match[1].toLowerCase(); // $1: tag name including any '/'
            // script/style block is parsed as another tag to extract attributes
            if (name_1 === 'script' || name_1 === 'style') {
                state.scryle = name_1; // used by parseText
            }
            this.pushTag(state, name_1, start, end);
            // only '>' can ends the tag here, the '/' is handled in parseAttr
            if (!match[2]) {
                return 2 /* ATTR */;
            }
        }
        else {
            this.pushText(state, start, pos); // pushes the '<' as text
        }
        return 3 /* TEXT */;
    };
    /**
     * Parses comments in long or short form
     * (any DOCTYPE & CDATA blocks are parsed as comments).
     *
     * @param {ParseState} state  - Parser state
     * @param {string} data       - Buffer to parse
     * @param {number} start      - Position of the '<!' sequence
     * @private
     */
    TagParser.prototype.cmnt = function (state, data, start) {
        var pos = start + 2; // skip '<!'
        var str = data.substr(pos, 2) === '--' ? '-->' : '>';
        var end = data.indexOf(str, pos);
        if (end < 0) {
            this.err(data, MSG.unclosedComment, start);
        }
        this.pushCmnt(state, start, end + str.length);
    };
    /**
     * The more complex parsing is for attributes as it can contain quoted or
     * unquoted values or expressions.
     *
     * @param   {ParseState} state  - Parser state
     * @param   {string} data       - Buffer to parse
     * @returns {number} New parser mode.
     * @private
     */
    TagParser.prototype.attr = function (state, data) {
        var tag = state.last; // the last (current) tag in the output
        var _CH = /\S/g; // matches the first non-space char
        _CH.lastIndex = state.pos; // first char of attribute's name
        var ch = _CH.exec(data);
        if (!ch) {
            state.pos = data.length; // reaching the end of the buffer with
            // NodeTypes.ATTR will generate error
        }
        else if (ch[0] === '>') {
            // closing char found. If this is a self-closing tag with the name of the
            // Root tag, we need decrement the counter as we are changing mode.
            state.pos = tag.end = _CH.lastIndex;
            if (tag.selfclose) {
                state.scryle = null; // allow selfClosing script/style tags
                if (state.root && state.root.name === tag.name) {
                    state.count--; // "pop" root tag
                }
            }
            return 3 /* TEXT */;
        }
        else if (ch[0] === '/') {
            state.pos = _CH.lastIndex; // maybe. delegate the validation
            tag.selfclose = true; // the next loop
        }
        else {
            delete tag.selfclose; // ensure unmark as selfclosing tag
            this.setAttr(state, data, ch.index, tag);
        }
        return 2 /* ATTR */;
    };
    /**
     * Parses an attribute and its expressions.
     *
     * @param   {ParseState}  state  - Parser state
     * @param   {string} data   - Whole buffer
     * @param   {number} pos    - Starting position of the attribute
     * @param   {Object} tag    - Current parent tag
     * @private
     */
    TagParser.prototype.setAttr = function (state, data, pos, tag) {
        var re = ATTR_START; // (\S[^>/=\s]*)(?:\s*=\s*([^>/])?)? g
        var start = re.lastIndex = pos; // first non-whitespace
        var match = re.exec(data);
        if (!match) {
            return;
        }
        var end = re.lastIndex;
        var quote = match[2]; // first letter of value or nothing
        var attr = { name: match[1].toLowerCase(), value: '', start: start, end: end };
        // parse the whole value (if any) and get any expressions on it
        if (quote) {
            // Usually, the value's first char (`quote`) is a quote and the lastIndex
            // (`end`) is the start of the value.
            var valueStart = end;
            // If it not, this is an unquoted value and we need adjust the start.
            if (quote !== '"' && quote !== "'") {
                quote = ''; // first char of value is not a quote
                valueStart--; // adjust the starting position
            }
            end = this.expr(state, data, attr, quote || '[>/\\s]', valueStart);
            // adjust the bounds of the value and save its content
            attr.value = data.slice(valueStart, end);
            attr.valueStart = valueStart;
            attr.end = quote ? ++end : end;
        }
        //assert(q && q.type === Mode.TAG, 'no previous tag for the attr!')
        // Pushes the attribute and shifts the `end` position of the tag (`last`).
        state.pos = tag.end = end;
        (tag.attr || (tag.attr = [])).push(attr);
    };
    /**
     * Parses regular text and script/style blocks ...scryle for short :-)
     * (the content of script and style is text as well)
     *
     * @param   {ParseState} state - Parser state
     * @param   {string} data  - Buffer to parse
     * @returns {number} New parser mode.
     * @private
     */
    TagParser.prototype.text = function (state, data) {
        var me = this;
        var pos = state.pos; // start of the text
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
            state.scryle = null; // reset the script/style flag now
            // write the tag content, if any
            if (start > pos) {
                me.pushText(state, pos, start);
            }
            // now the closing tag, either </script> or </style>
            me.pushTag(state, "/" + name_2, start, end);
        }
        else if (data[pos] === '<') {
            state.pos++;
            return 1 /* TAG */;
        }
        else {
            var info = {};
            var end = this.expr(state, data, info, '<', pos);
            me.pushText(state, pos, end, info.expr, info.unescape);
        }
        return 3 /* TEXT */;
    };
    /**
     * Find the end of the attribute value or text node
     * Extract expressions.
     * Detect if value have escaped brackets.
     *
     * @param   {ParseState} state  - Parser state
     * @param   {string} data       - Source code
     * @param   {HasExpr} node      - Node if attr, info if text
     * @param   {string} endingChars - Ends the value or text
     * @param   {number} pos        - Starting position
     * @returns {number} Ending position
     * @private
     */
    TagParser.prototype.expr = function (state, data, node, endingChars, pos) {
        var me = this;
        var expr = [];
        var re = me.b0re(endingChars);
        var match;
        re.lastIndex = pos;
        // Anything captured in $1 (closing quote or character) ends the loop...
        while ((match = re.exec(data)) && !match[1]) {
            // ...else, we have an opening bracket and maybe an expression.
            pos = match.index;
            if (data[pos - 1] === '\\') {
                node.unescape = match[0]; // it is an escaped opening brace
            }
            else {
                var tmpExpr = exprExtr(data, pos, me.bp);
                if (tmpExpr) {
                    expr.push(tmpExpr);
                    re.lastIndex = tmpExpr.end;
                }
            }
        }
        // Even for text, the parser needs match a closing char
        if (!match) {
            me.err(data, MSG.unexpectedEndOfFile, pos);
        }
        // adjust the bounds of the value and save its content
        if (expr.length) {
            node.expr = expr;
        }
        return match.index;
    };
    /**
     * Creates a regex for the given string and the left bracket.
     * The string is captured in $1.
     *
     * @param   {string} str - String to search
     * @returns {RegExp} Resulting regex.
     * @private
     */
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
export default TagParser;
