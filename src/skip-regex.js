
// safe characters to precced a regex (including `=>`, `**`, and `...`)
const beforeReChars = '[{(,;:?=|&!^~>%*/'

// keyword that can preceed a regex (`in` is handled as special case)
const beforeReWords = [
  'case',
  'default',
  //'delete',
  'do',
  'else',
  //'extends',
  'in',
  'instanceof',
  //'new',
  'prefix',
  'return',
  //'throw',
  'typeof',
  'void',
  'yield'
]

// The string to test can't include line-endings
const RE_REGEX = /^\/(?=[^*>/])[^[/\\]*(?:\\.|(?:\[(?:\\.|[^\]\\]*)*\])[^[\\/]*)*?\/(?=[gimuy]+|[^/\*]|$)/
const RE_VARCHAR = /[$\w]/

// Searches the position of the previous non-blank character inside `code`,
// starting with `pos - 1`.
function prev(code, pos) {
  while (--pos >= 0 && /\s/.test(code[pos]));
  return pos
}

/**
 * Check if the code in the `start` position can be a regex.
 *
 * @param   {string} code  - Buffer to test in
 * @param   {number} start - Position following the slash inside `code`
 * @returns {number} `true` if the slash can start a regex.
 */
export default function skipRegex(code, start) {

  // `exec()` will extract from the slash to the end of line and the
  // chained `match()` will match the possible regex.
  const re = /.*/g
  let pos = re.lastIndex = start - 1
  const match = re.exec(code)[0].match(RE_REGEX)

  if (match) {
    const next = pos + match[0].length  // result is not from `re.exec`

    pos = prev(code, pos)
    const c = code[pos]

    // start of buffer or safe prefix?
    if (pos < 0 || ~beforeReChars.indexOf(c)) {
      return next
    }

    // from here, `pos` is >= 0 and `c` is code[pos]
    if (c === '.') {
      // can be `...` or something silly like 5./2
      if (code[pos - 1] === '.') {
        start = next
      }

    } else if (c === '+' || c === '-') {
      // tricky case, with a sigle + or -  operator, the slash always starts
      // a regex, but with the unary ++ (or --), we need found
      //   identifierOrLiteral_number operator+operator RegExp
      // Example (assume a=1, x=1, i=1):
      // `++/x/i.lastIndex` --- `/x/` a regex
      // `a++/x/i` = 1 --- here `/x/` is not a regex
      // `a-++/x/i.lastIndex` = 0 -- `/x/` is a regex
      // `++/x/i` generates a ReferenceError
      if (code[--pos] !== c ||              // single operator, always regex
          (pos = prev(code, pos)) < 0 ||    // no previous token, always regex
          !RE_VARCHAR.test(code[pos])) {    // previous token can't be a JS var or number
        start = next
      }

    } else if (/[a-z]/.test(c)) {
      // keyword?
      ++pos
      for (let i = 0; i < beforeReWords.length; i++) {
        const kw = beforeReWords[i]
        const nn = pos - kw.length
        if (nn >= 0 && code.slice(nn, pos) === kw && !RE_VARCHAR.test(code[nn - 1])) {
          start = next
          break
        }
      }
    }
  }

  return start
}
