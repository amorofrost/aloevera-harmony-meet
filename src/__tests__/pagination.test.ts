import type { PagedResult } from '@/types';
import { describe, it, expect } from 'vitest';

describe('PagedResult type', () => {
  it('can be constructed with all fields', () => {
    const result: PagedResult<number> = {
      items: [1, 2, 3],
      pageSize: 3,
      hasMore: true,
      nextCursor: 'abc',
      total: 42,
    };
    expect(result.items).toHaveLength(3);
    expect(result.nextCursor).toBe('abc');
  });

  it('optional fields default to undefined', () => {
    const result: PagedResult<string> = {
      items: [],
      pageSize: 10,
      hasMore: false,
    };
    expect(result.nextCursor).toBeUndefined();
    expect(result.total).toBeUndefined();
  });
});
