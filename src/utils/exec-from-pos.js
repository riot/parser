/**
 * Run RegExp.exec starting from a specific position
 * @param   {RegExp} re - regex
 * @param   {number} pos - last index position
 * @param   {string} string - regex target
 * @returns {Array} regex result
 */
export default function execFromPos(re, pos, string) {
  re.lastIndex = pos
  return re.exec(string)
}