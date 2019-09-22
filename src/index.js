import * as c from './constants'
import * as types from './node-types'
import parser from './parser'

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

