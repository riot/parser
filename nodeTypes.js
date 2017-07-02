'use strict';

/**
 * Not all the types are handled in this module.
 *
 * @enum {number}
 * @readonly
 */
var nodeTypes = {
    TAG: 1 /* TAG */,
    ATTR: 2 /* ATTR */,
    TEXT: 3 /* TEXT */,
    CDATA: 4 /* CDATA */,
    COMMENT: 8 /* COMMENT */,
    DOCUMENT: 9 /* DOCUMENT */,
    DOCTYPE: 10 /* DOCTYPE */,
    DOCUMENT_FRAGMENT: 11 /* DOCUMENT_FRAGMENT */,
};

module.exports = nodeTypes;
