/**
 * Matches the start of valid tags names; used with the first 2 chars after the `'<'`.
 * @const
 * @private
 */
export const TAG_2C = /^(?:\/[a-zA-Z]|[a-zA-Z][^\s>/]?)/
/**
 * Matches valid tags names AFTER the validation with `TAG_2C`.
 * $1: tag name including any `'/'`, $2: non self-closing brace (`>`) w/o attributes.
 * @const
 * @private
 */
export const TAG_NAME = /(\/?[^\s>/]+)\s*(>)?/g
/**
 * Matches an attribute name-value pair (both can be empty).
 * $1: attribute name, $2: value including any quotes.
 * @const
 * @private
 */
export const ATTR_START = /(\S[^>/=\s]*)(?:\s*=\s*([^>/])?)?/g

/**
 * Matches the spread operator
 * it will be used for the spread attributes
 * @type {RegExp}
 */
export const SPREAD_OPERATOR = /\.\.\./
/**
 * Matches the closing tag of a `script` and `style` block.
 * Used by parseText fo find the end of the block.
 * @const
 * @private
 */
export const RE_SCRYLE = {
  script: /<\/script\s*>/gi,
  style: /<\/style\s*>/gi,
  textarea: /<\/textarea\s*>/gi
}

// Do not touch text content inside this tags
export const RAW_TAGS = /^\/?(?:pre|textarea)$/
