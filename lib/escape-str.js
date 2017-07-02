/**
 * Escape special characters in a given string, in preparation to create a regex.
 *
 * @param   {string} str - Raw string
 * @returns {string} Escaped string.
 */
export default function (str) { return str.replace(/(?=[-[\](){^*+?.$|\\])/g, '\\'); };
