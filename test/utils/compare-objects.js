/*
  Simple object comparison.
*/
'use strict'

function isEmpty(v) {
  if (!v) return true
  return typeof v == 'object'
    ? Array.isArray(v) ? !v.length : !Object.keys(v).length
    : false
}

function compareObjects(a, b) {
  if (a === b) return true
  var p

  for (p in a) {
    if (typeof b[p] == 'undefined') {
      if (/^(?:start|end)$/.test(p) && isEmpty(a[p])) {
        continue
      }
      return false
    }
    if (a[p]) {
      switch (typeof a[p]) {
        case 'object':
          if (!compareObjects(a[p], b[p])) {
            return false
          }
          break
        case 'function':
          if (typeof b[p] != 'function') {
            return false
          }
          break
        default:
          if (a[p] !== b[p]) {
            return false
          }
      }
    } else if (a[p] !== b[p]) {
      return false
    }
  }

  for (p in b) {
    if (typeof a[p] == 'undefined') {
      return false
    }
  }

  return true
}

module.exports = compareObjects
