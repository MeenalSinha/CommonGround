import { env } from '@/config/env';
import type { ErrorEnvelope } from '@/types/api';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number | null,
    public readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isEnvelope(value: unknown): value is ErrorEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ErrorEnvelope).error?.code === 'string' &&
    typeof (value as ErrorEnvelope).error?.message === 'string'
  );
}

export async function request<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; query?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const url = new URL(path, `${env.apiBaseUrl}/`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.requestTimeoutMs);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: options.method ?? 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } catch (cause) {
    const aborted = cause instanceof Error && cause.name === 'AbortError';
    throw new ApiError(
      aborted ? 'backend_timeout' : 'backend_unreachable',
      aborted
        ? 'The CommonGround backend took too long to respond.'
        : 'Could not reach the CommonGround backend. Is it running, and is the address right?',
      null,
    );
  } finally {
    clearTimeout(timer);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    if (isEnvelope(body)) {
      throw new ApiError(
        body.error.code,
        body.error.message,
        response.status,
        body.error.request_id,
      );
    }
    throw new ApiError(
      'http_error',
      `The backend returned an error (${response.status}).`,
      response.status,
    );
  }
  if (body === null) {
    throw new ApiError(
      'invalid_response',
      'The backend returned an unreadable response.',
      response.status,
    );
  }
  return body as T;
}
