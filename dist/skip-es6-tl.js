'use strict';

var $_ES6_BQ = '`';
function skipES6TL(code, pos, stack) {
    var re = /[`$\\]/g;
    var c;
    while (re.lastIndex = pos, re.exec(code)) {
        pos = re.lastIndex;
        c = code[pos - 1];
        if (c === '`') {
            return pos;
        }
        if (c === '$' && code[pos++] === '{') {
            stack.push($_ES6_BQ, '}');
            return pos;
        }
    }
    throw new Error('Unclosed ES6 template');
}

module.exports = skipES6TL;
