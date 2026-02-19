import type { ApiResponse } from './apiClient';
import type { AloeVeraSong } from '@/types/user';
import { mockSongs } from '@/data/mockSongs';

// Songs endpoint is not yet implemented in the backend.
// This service always uses mock data regardless of mode.

function mockSuccess<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: new Date().toISOString() };
}

export const songsApi = {
  async getSongs(): Promise<ApiResponse<AloeVeraSong[]>> {
    return mockSuccess(mockSongs);
  },
};
