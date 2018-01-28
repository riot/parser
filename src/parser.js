import panic from './utils/panic'
import flush from './utils/flush-parser-store'
import treeBuilder from './tree-builder'
import { unexpectedEndOfFile, rootTagNotFound } from './messages'
import curry from 'curri'
import { ATTR, TAG } from './node-types'
import { tag } from './parsers/tag'
import { attr } from './parsers/attribute'
import { text } from './parsers/text'

/**
 * Factory for the Parser class, exposing only the `parse` method.
 * The export adds the Parser class as property.
 *
 * @param   {Object}   options - User Options
 * @param   {Function} customBuilder - Tree builder factory
 * @returns {Function} Public Parser implementation.
 */
export default function parser(options, customBuilder) {
  const store = curry(createStore)(options, customBuilder || treeBuilder)
  return {
    parse: (data) => parse(store(data))
  }
}

/**
 * Create a new store object
 * @param   {object} userOptions - parser options
 * @param   {Function} customBuilder - Tree builder factory
 * @param   {string} data - data to parse
 * @returns {ParserStore}
 */
function createStore(userOptions, builder, data) {
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
 * @param   {ParserStore}  store - Current parser store
 * @returns {ParserResult} Result, contains data and output properties.
 */
function parse(store) {
  const { data } = store

  walk(store)
  flush(store)

  if (store.count) {
    panic(data, store.count > 0 ? unexpectedEndOfFile : rootTagNotFound, store.pos)
  }

  return {
    data,
    output: store.builder.get()
  }
}

/**
 * Parser walking recursive function
 * @param {ParserStore}  store - Current parser store
 * @param   {string} type - current parsing context
 */
function walk(store, type) {
  const { data } = store
  // extend the store adding the tree builder instance and the initial data
  const length = data.length

  // The "count" property is set to 1 when the first tag is found.
  // This becomes the root and precedent text or comments are discarded.
  // So, at the end of the parsing count must be zero.
  if (store.pos < length && store.count) {
    walk(store, eat(store, type))
  }
}

/**
 * Function to help iterating on the current parser store
 * @param {ParserStore}  store - Current parser store
 * @param   {string} type - current parsing context
 * @returns {string} parsing context
 */
function eat(store, type) {
  switch (type) {
  case TAG:
    return tag(store)
  case ATTR:
    return attr(store)
  default:
    return text(store)
  }
}