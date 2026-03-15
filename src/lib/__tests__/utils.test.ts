import { cn } from '@/lib/utils';

describe('cn', () => {
  it('merges multiple class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('omits falsy conditionals', () => {
    expect(cn('foo', false && 'bar', undefined, 'baz')).toBe('foo baz');
  });

  it('resolves Tailwind conflicts — last utility wins', () => {
    // twMerge keeps the last conflicting utility
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});
