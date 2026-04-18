/**
 * Decode JWT payload (middle segment) without verifying signature.
 * Used client-side only for UI gating; authorization is enforced by the API.
 */
export function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getStaffRoleFromAccessToken(token: string | null): string | null {
  if (!token) return null;
  const payload = parseJwtPayload(token);
  if (!payload) return null;
  const role = payload.staffRole;
  return typeof role === 'string' ? role : null;
}
