import Parser from './parser-class'
import treeBuilder from './tree-builder'
/**
 * Factory for the Parser class, exposing only the `parse` method.
 * The export adds the Parser class as property.
 *
 * @param   {Object}   options - User Options
 * @param   {Function} [tbf]   - Tree builder factory
 * @returns {Function} Public Parser implementation.
 */
export default function parser(options, tbf) {
  return new Parser(tbf || treeBuilder, options)
}
