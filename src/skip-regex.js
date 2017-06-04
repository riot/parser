
// safe characters to precced a regex (including `=>`, `**`, and `...`)
const beforeReChars = '[{(,;:?=|&!^~>%*/'

// keyword that can preceed a regex (`in` is handled as special case)
// Makes no sense to include delete, instanceof, extends, new, throw.
const beforeReWords = [
  'case',
  'default',
  'do',
  'else',
  'in',
  'return',
  'typeof',
  'void',
  'yield'
]

// Pre-testing the keywords can speedup the search about 30%
const wordsLastChar = beforeReWords.reduce((s, w) => s + w.slice(-1), '')

// The regexes can't include line-endings
const RE_REGEX = /^\/(?=[^*>/])[^[/\\]*(?:(?:\\.|\[(?:\\.|[^\]\\]*)*\])[^[\\/]*)*?\/[gimuy]*/

// Valid characters for JavaScript identifiers and literal numbers
const RE_VN_CHAR = /[$\w]/

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
    const next = pos + match[0].length  // result comes from `match()`

    pos = prev(code, pos)
    const c = code[pos]

    // start of buffer or safe prefix?
    if (pos < 0 || ~beforeReChars.indexOf(c)) {
      return next
    }

    // from here, `pos` is >= 0 and `c` is code[pos]
    // altough match[0] looks like a regex, we need to double-check this
    if (c === '.') {
      // can be `...` or something silly like 5./2
      if (code[pos - 1] === '.') {
        start = next
      }

    } else if (c === '+' || c === '-') {
      // tricky case
      if (code[--pos] !== c ||              // if have a single operator or
          (pos = prev(code, pos)) < 0 ||    // ...have `++` and no previous token or
          !RE_VN_CHAR.test(code[pos])) {    // ...the token is not a JS var/number
        start = next                        // ...this is a regex
      }

    } else if (~wordsLastChar.indexOf(c)) {
      // keyword?
      const end = pos + 1

      // get the preceding keyword, if this is in out list we have a regex
      while (--pos >= 0 && RE_VN_CHAR.test(code[pos]));
      if (~beforeReWords.indexOf(code.slice(pos + 1, end))) {
        start = next
      }
    }
  }

  return start
}
