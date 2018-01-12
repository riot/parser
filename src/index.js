import parser from './tag-parser'
/*
 * Export class TagParser if anyone want to subclass it.
 */
export { default as TagParser } from './tag-parser-class'
/*
 * Function to skip ES6 Literal String in a buffer.
 */
export { default as skipES6TL } from './skip-es6-tl'
/**
 * The nodeTypes definition
 */
export { default as nodeTypes } from './node-types'

/*
 * Factory function to create instances of the parser
 */
export default parser
