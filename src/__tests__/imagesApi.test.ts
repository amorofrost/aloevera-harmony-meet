import { describe, it, expect, vi } from 'vitest';

vi.mock('@/config/api.config', () => ({
  API_CONFIG: { mode: 'mock', baseURL: '', timeout: 30000 },
  isApiMode: () => false,
  isMockMode: () => true,
}));

import { uploadImage } from '@/services/api/imagesApi';

describe('imagesApi — mock mode', () => {
  it('returns a placeholder URL without an HTTP call', async () => {
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    const result = await uploadImage(file);
    expect(result.url).toBe('https://placehold.co/600x400');
  });

  it('resolves with an object that has a url string', async () => {
    const file = new File(['img'], 'photo.png', { type: 'image/png' });
    const result = await uploadImage(file);
    expect(typeof result.url).toBe('string');
    expect(result.url.length).toBeGreaterThan(0);
  });
});
