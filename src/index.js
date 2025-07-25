import * as c from './constants.js'
import * as types from './node-types.js'
import parser from './parser.js'

/**
 * Expose the internal constants
 */
export const constants = c

/**
 * The nodeTypes definition
 */
export const nodeTypes = types

/*
 * Factory function to create instances of the parser
 */
export default parser
