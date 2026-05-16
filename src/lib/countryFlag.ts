const ISO_CODE_RE = /^[A-Z]{2}$/;

const isIsoCode = (s: string): boolean => ISO_CODE_RE.test(s);

/**
 * Convert an ISO-3166-1 alpha-2 code to its flag emoji.
 * Returns '' for anything that isn't a 2-uppercase-letter code so the caller
 * can fall back to a non-flag rendering for custom country labels.
 */
export function flagEmoji(country: string): string {
  if (!isIsoCode(country)) return '';
  const A = 0x1f1e6; // regional indicator A
  return String.fromCodePoint(
    A + country.charCodeAt(0) - 65,
    A + country.charCodeAt(1) - 65,
  );
}

export const isCustomCountry = (country: string): boolean =>
  country.length > 0 && !isIsoCode(country);
