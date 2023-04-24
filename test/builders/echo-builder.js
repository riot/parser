/*
 * The default builder is a simple Echo.
 */
const Echo = {
  init(errorFn) {
    this.output = []
    this.error = errorFn
    return this
  },

  get() {
    return this.output
  },

  push(node) {
    this.output.push(node)
  },
}

export default function (_, errorFn) {
  return Object.create(Echo).init(errorFn)
}
