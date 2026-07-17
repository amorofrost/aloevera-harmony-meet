/**
 * Validate a post-auth navigation target passed to the Telegram Mini App via the
 * `?dest=` query param (e.g. from a notification's "Open in app" button).
 *
 * Only same-app relative paths are allowed: the value must start with a single `/`
 * (rejecting protocol-relative `//host` and absolute `scheme://` URLs). This bounds
 * navigation to in-app routes and removes any open-redirect surface.
 *
 * @returns the safe relative path, or null when the input is missing/unsafe.
 */
export function sanitizeDest(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  return raw;
}
