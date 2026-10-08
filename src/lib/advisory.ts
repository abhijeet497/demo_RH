/**
 * External link for a published advisory id: GHSA to the GitHub Advisory DB,
 * CVE to NVD. Returns null for an unrecognized format so callers render plain
 * text instead of guessing a destination.
 */
export function advisoryHref(id: string): string | null {
  const seg = encodeURIComponent(id)
  if (/^GHSA-/i.test(id)) return `https://github.com/advisories/${seg}`
  if (/^CVE-/i.test(id)) return `https://nvd.nist.gov/vuln/detail/${seg}`
  return null
}
