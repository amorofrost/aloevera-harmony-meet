import { apiClient, isApiMode, type ApiResponse } from './apiClient';

export interface AppConfigDto {
  rankThresholds: Record<string, string>;
  permissions: Record<string, string>;
  /** Site-wide registration policy (partition <code>registration</code> in appconfig). */
  registration: Record<string, string>;
}

export const adminApi = {
  async getConfig(): Promise<ApiResponse<AppConfigDto>> {
    if (!isApiMode()) {
      return {
        success: false,
        error: {
          code: 'ADMIN_REQUIRES_API',
          message: 'Admin panel requires VITE_API_MODE=api',
        },
        timestamp: new Date().toISOString(),
      };
    }
    return apiClient.get<AppConfigDto>('/api/v1/admin/config');
  },
};
