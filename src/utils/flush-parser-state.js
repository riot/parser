/**
 * Outputs the last parsed node. Can be used with a builder too.
 *
 * @param   {ParserStore} store - Parsing store
 * @returns {undefined} void function
 * @private
 */
export default function flush(store) {
  const last = store.last
  store.last = null
  if (last && store.root) {
    store.builder.push(last)
  }
}
