import parser from './parser'
import * as _nodeTypes from './node-types'

/**
 * The nodeTypes definition
 */
export const nodeTypes = _nodeTypes

/**
 * Void svg and html tags
 */
export { default as voidTags } from './void-tags'

/*
 * Factory function to create instances of the parser
 */
export default parser
