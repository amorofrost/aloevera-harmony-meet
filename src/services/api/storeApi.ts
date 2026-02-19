import { apiClient, isApiMode, type ApiResponse } from './apiClient';
import { mockStoreItems, type StoreItem } from '@/data/mockStoreItems';

function mockSuccess<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: new Date().toISOString() };
}

function mapStoreItemFromApi(dto: any): StoreItem {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description ?? '',
    price: Number(dto.price),
    imageUrl: dto.imageUrl,
    category: dto.category,
    externalPurchaseUrl: dto.externalPurchaseUrl ?? undefined,
  };
}

export const storeApi = {
  async getStoreItems(): Promise<ApiResponse<StoreItem[]>> {
    if (isApiMode()) {
      const res = await apiClient.get<any[]>('/api/v1/store');
      if (res.success && res.data) {
        return { ...res, data: res.data.map(mapStoreItemFromApi) };
      }
      return res as ApiResponse<StoreItem[]>;
    }
    return mockSuccess(mockStoreItems);
  },

  async getStoreItemById(id: string): Promise<ApiResponse<StoreItem | null>> {
    if (isApiMode()) {
      const res = await apiClient.get<any>(`/api/v1/store/${id}`);
      if (res.success && res.data) {
        return { ...res, data: mapStoreItemFromApi(res.data) };
      }
      return res as ApiResponse<StoreItem | null>;
    }
    const item = mockStoreItems.find(i => i.id === id) ?? null;
    return mockSuccess(item);
  },
};
