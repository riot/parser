/**
 * Run RegExp.exec starting from a specific position
 * @param   {[type]} re   [description]
 * @param   {[type]} pos  [description]
 * @param   {[type]} data [description]
 * @returns {[type]}      [description]
 */
export default function execFromPos(re, pos, data) {
  re.lastIndex = pos
  return re.exec(data)
}