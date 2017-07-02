import TagParser from './tag-parser-class';
import treeBuilder from './tree-builder';
/**
 * Factory for the TagParser class, exposing only the `parse` method.
 * The export adds the TagParser class as property.
 *
 * @param   {Object}   options - User Options
 * @param   {Function} [tbf]   - Tree builder factory
 * @returns {Function} Public TagParser implementation.
 */
export default function tagParser(options, tbf) {
    return new TagParser(tbf || treeBuilder, options);
}
