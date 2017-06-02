/*
  This polyfill doesn't support symbol properties, since ES5 doesn't have symbols anyway.
*/
if (typeof Object.assign != 'function') {
  Object.defineProperty(Object, 'assign', {
    configurable: true,
    writable: true,
    value: function (dest) {
      if (dest == null) {
        throw new TypeError('Cannot convert dest to object')
      }
      var arg = arguments

      dest = Object(dest)
      for (var ix = 1; ix < arg.length; ix++) {
        var src = arg[ix]
        if (src != null) {
          var k, key, keys = Object.keys(Object(src))
          for (k = 0; k < keys.length; k++) {
            key = keys[k]
            dest[key] = src[key]
          }
        }
      }
      return dest
    }
  })
}

export default Object.assign
