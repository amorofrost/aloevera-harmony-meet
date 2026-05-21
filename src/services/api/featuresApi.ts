import { apiClient, isApiMode, type ApiResponse } from './apiClient';

/**
 * Client-visible feature flags. Snapshot returned by GET /api/v1/features.
 * Mirrors backend FeatureFlagsDto.
 *
 * Defaults here match backend `FeatureFlagsConfig.Defaults` — both must stay in
 * sync. If the backend call fails (mock mode without API, network down, etc.),
 * we fall back to these defaults rather than hiding features behind a flag we
 * couldn't fetch.
 */
export interface FeatureFlags {
  feedEnabled: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  feedEnabled: true,
};

export const featuresApi = {
  async getFlags(): Promise<ApiResponse<FeatureFlags>> {
    if (isApiMode()) {
      return apiClient.get<FeatureFlags>('/api/v1/features');
    }
    return {
      success: true,
      data: { ...DEFAULT_FEATURE_FLAGS },
      timestamp: new Date().toISOString(),
    };
  },
};
