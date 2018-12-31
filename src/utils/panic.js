import formatError from './format-error'

/**
 * Custom error handler can be implemented replacing this method.
 * The `state` object includes the buffer (`data`)
 * The error position (`loc`) contains line (base 1) and col (base 0).
 * @param {string} data - string containing the error
 * @param {string} msg - Error message
 * @param {number} pos - Position of the error
 * @returns {undefined} throw an exception error
 */
export default function panic(data, msg, pos) {
  const message = formatError(data, msg, pos)
  throw new Error(message)
}