/**
 * Public runtime configuration. Only EXPO_PUBLIC_* values are readable here and they are
 * bundled into the app: this module must never contain or reference any secret.
 */

const DEFAULT_API_BASE_URL = 'http://localhost:8000';

export function resolveApiBaseUrl(raw: string | undefined, isProduction = false): string {
  const value = (raw ?? '').trim();
  if (!value) {
    if (isProduction) {
      throw new Error(
        'EXPO_PUBLIC_API_BASE_URL must be configured for production deployments; localhost cannot be used.',
      );
    }
    return DEFAULT_API_BASE_URL;
  }
  if (!/^https?:\/\//i.test(value)) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must start with http:// or https://');
  }
  return value.replace(/\/+$/, '');
}

declare const __DEV__: boolean | undefined;
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

export const env = {
  apiBaseUrl: resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL, !isDev),
  requestTimeoutMs: 8000,
} as const;
