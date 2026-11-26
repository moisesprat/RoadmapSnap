/**
 * Allowlist for stored links. React does not block javascript: hrefs, so a link written to
 * projects.external_link must be an http or https URL before it is stored.
 */

/**
 * True only when value parses as an absolute URL whose protocol is http: or https:.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isHttpUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}
