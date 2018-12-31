import {ATTR, TAG} from './node-types'
import {rootTagNotFound, unexpectedEndOfFile} from './messages'
import attr from './parsers/attribute'
import curry from 'curri'
import flush from './utils/flush-parser-state'
import panic from './utils/panic'
import tag from './parsers/tag'
import text from './parsers/text'
import treeBuilder from './tree-builder'

/**
 * Factory for the Parser class, exposing only the `parse` method.
 * The export adds the Parser class as property.
 *
 * @param   {Object}   options - User Options
 * @param   {Function} customBuilder - Tree builder factory
 * @returns {Function} Public Parser implementation.
 */
export default function parser(options, customBuilder) {
  const state = curry(createParserState)(options, customBuilder || treeBuilder)
  return {
    parse: (data) => parse(state(data))
  }
}

/**
 * Create a new state object
 * @param   {Object} userOptions - parser options
 * @param   {Function} builder - Tree builder factory
 * @param   {string} data - data to parse
 * @returns {ParserState} it represents the current parser state
 */
function createParserState(userOptions, builder, data) {
  const options = Object.assign({
    brackets: ['{', '}']
  }, userOptions)

  return {
    options,
    regexCache: {},
    pos: 0,
    count: -1,
    root: null,
    last: null,
    scryle: null,
    builder: builder(data, options),
    data
  }
}

/**
 * It creates a raw output of pseudo-nodes with one of three different types,
 * all of them having a start/end position:
 *
 * - TAG     -- Opening or closing tags
 * - TEXT    -- Raw text
 * - COMMENT -- Comments
 *
 * @param   {ParserState}  state - Current parser state
 * @returns {ParserResult} Result, contains data and output properties.
 */
function parse(state) {
  const { data } = state

  walk(state)
  flush(state)

  if (state.count) {
    panic(data, state.count > 0 ? unexpectedEndOfFile : rootTagNotFound, state.pos)
  }

  return {
    data,
    output: state.builder.get()
  }
}

/**
 * Parser walking recursive function
 * @param {ParserState}  state - Current parser state
 * @param {string} type - current parsing context
 * @returns {undefined} void function
 */
function walk(state, type) {
  const { data } = state
  // extend the state adding the tree builder instance and the initial data
  const length = data.length

  // The "count" property is set to 1 when the first tag is found.
  // This becomes the root and precedent text or comments are discarded.
  // So, at the end of the parsing count must be zero.
  if (state.pos < length && state.count) {
    walk(state, eat(state, type))
  }
}

/**
 * Function to help iterating on the current parser state
 * @param {ParserState}  state - Current parser state
 * @param   {string} type - current parsing context
 * @returns {string} parsing context
 */
function eat(state, type) {
  switch (type) {
  case TAG:
    return tag(state)
  case ATTR:
    return attr(state)
  default:
    return text(state)
  }
}