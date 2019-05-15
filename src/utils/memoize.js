/**
 * Memoization function
 * @param   {Function} fn - function to memoize
 * @returns {*} return of the function to memoize
 */
export default function memoize(fn) {
  const cache = new WeakMap()

  return (...args) => {
    if (cache.has(args[0])) return cache.get(args[0])

    const ret = fn(...args)

    cache.set(args[0], ret)

    return ret
  }
}