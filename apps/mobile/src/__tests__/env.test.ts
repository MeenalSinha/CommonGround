import { resolveApiBaseUrl } from '@/config/env';
import { entityTypeLabel } from '@/utils/format';

describe('resolveApiBaseUrl', () => {
  it('falls back to a local default and strips trailing slashes', () => {
    expect(resolveApiBaseUrl(undefined)).toBe('http://localhost:8000');
    expect(resolveApiBaseUrl('  https://api.example.test// ')).toBe('https://api.example.test');
  });
  it('rejects values without a scheme', () => {
    expect(() => resolveApiBaseUrl('localhost:8000')).toThrow(/http/);
  });
});

describe('entityTypeLabel', () => {
  it('formats URNs for display only', () => {
    expect(entityTypeLabel('urn:entity:tv_show')).toBe('Tv show');
    expect(entityTypeLabel(null)).toBe('Unknown type');
  });
});
