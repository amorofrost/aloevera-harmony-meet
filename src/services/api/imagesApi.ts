// src/services/api/imagesApi.ts
import { apiClient, isApiMode } from './apiClient';

interface UploadImageResponse {
  url: string;
}

export async function uploadImage(file: File): Promise<UploadImageResponse> {
  if (!isApiMode()) {
    // Simulate network delay in mock mode
    await new Promise<void>(resolve => setTimeout(resolve, 300));
    return { url: 'https://placehold.co/600x400' };
  }

  const formData = new FormData();
  formData.append('file', file);
  const res = await apiClient.postForm<{ Url: string }>('/api/v1/images/upload', formData);
  return { url: res.data!.Url };
}

export const imagesApi = { uploadImage };
