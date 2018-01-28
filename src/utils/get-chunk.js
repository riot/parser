/**
 * Get the code chunks from start and end range
 * @param   {string}  source  - source code
 * @param   {number}  start   - Start position of the chunk we want to extract
 * @param   {number}  end     - Ending position of the chunk we need
 * @returns {string}  chunk of code extracted from the source code received
 * @private
 */
export default function getChunk(source, start, end) {
  return source.slice(start, end)
}