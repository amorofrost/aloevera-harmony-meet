/**
 * Public invite lookups. Used by the Telegram Mini App to resolve an invite-code start_param
 * (`t.me/{bot}?startapp=inv-{code}`) into an event id so a signed-in user can be routed
 * straight to the matching event detail page.
 */

import { apiClient, isApiMode, type ApiResponse } from './apiClient';

export interface InviteEventLookupDto {
  eventId: string;
}

export const invitesApi = {
  /**
   * Resolve an invite code to the event it's tied to. Returns 404 for unknown / revoked /
   * expired / campaign codes. In mock mode the call is faked — we don't have an `eventinvites`
   * table client-side, so any code yields a stub `eventId: '1'` for local dev testing.
   */
  async lookupEvent(code: string): Promise<ApiResponse<InviteEventLookupDto>> {
    if (isApiMode()) {
      return apiClient.get<InviteEventLookupDto>(
        `/api/v1/invites/${encodeURIComponent(code)}/event`,
      );
    }
    return {
      success: true,
      data: { eventId: '1' },
      timestamp: new Date().toISOString(),
    };
  },
};
