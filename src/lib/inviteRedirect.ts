export function safeRedirectFrom(redirect: string): string {
  return redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.includes('://') ? redirect : '';
}

export function inviteCodeFrom(safeRedirect: string): string {
  if (!safeRedirect) return '';
  try {
    return new URL(safeRedirect, window.location.origin).searchParams.get('code') ?? '';
  } catch {
    return '';
  }
}
