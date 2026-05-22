import { describe, it, expect } from 'vitest';
import { accountNameSchema } from '@/lib/validators';

describe('accountNameSchema', () => {
  it.each(['alice', 'alice99', 'Alice_Doe', 'a1234', 'abcdefghijklmnopqrstuvwxyz012345'])(
    'accepts valid name %s', (name) => {
      expect(accountNameSchema.safeParse(name).success).toBe(true);
    });

  it.each(['', 'ab', 'abcd', '1alice', '_alice', 'alice-doe', 'alice.doe', 'alice doe', 'a'.repeat(33)])(
    'rejects invalid format %s', (name) => {
      expect(accountNameSchema.safeParse(name).success).toBe(false);
    });

  it.each(['admin', 'ADMIN', 'aloevera', 'telegram', 'system'])(
    'rejects reserved name %s', (name) => {
      expect(accountNameSchema.safeParse(name).success).toBe(false);
    });
});
