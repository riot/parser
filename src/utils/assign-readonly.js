/**
 * Assign readonly properties to an object. The properties are given in
 * an object which enumerable properties are copied to the destination.
 *
 * @param   {object}  dest      - The target of the copy
 * @param   {object}  propList  - List of properties to copy
 * @param   {boolean} [visible] - If trueish, new properties will be enumerables
 * @returns {object}  The same object
 */
export default function assignReadonly(dest, propList, visible) {
  const src   = Object(propList)
  const props = {}

  visible = !!visible
  Object.keys(src).forEach(p => {
    props[p] = { value: src[p], enumerable: visible }
  })

  return Object.defineProperties(dest, props)
}
