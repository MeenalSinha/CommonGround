/**
 * Public runtime configuration. Only EXPO_PUBLIC_* values are readable here and they are
 * bundled into the app: this module must never contain or reference any secret.
 */

const DEFAULT_API_BASE_URL = 'http://localhost:8000';

export function resolveApiBaseUrl(raw: string | undefined): string {
  const value = (raw ?? '').trim() || DEFAULT_API_BASE_URL;
  if (!/^https?:\/\//i.test(value)) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must start with http:// or https://');
  }
  return value.replace(/\/+$/, '');
}

export const env = {
  apiBaseUrl: resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL),
  requestTimeoutMs: 8000,
} as const;
