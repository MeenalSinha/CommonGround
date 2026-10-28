/** Test-only helpers. These payloads exist solely to exercise UI states and are never shipped. */
import type { QlooStatus } from '@/types/api';

export function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

export function qlooStatus(overrides: Partial<QlooStatus> = {}): QlooStatus {
  return {
    state: 'not_configured',
    configured: false,
    ready: false,
    message:
      'The cultural engine is being connected. Live discoveries are not available until a Qloo API key is added to the backend.',
    base_host: 'qloo.test',
    last_checked_at: null,
    last_verified_at: null,
    last_error_code: null,
    ...overrides,
  };
}

export const health = {
  status: 'ok',
  service: 'commonground-backend',
  version: '0.1.0',
  time: '2026-01-01T00:00:00Z',
};

type Route = (url: URL, init?: RequestInit) => Response | Promise<Response>;

/** Installs a fetch mock that dispatches on pathname. Unmatched routes fail the test loudly. */
export function mockBackend(routes: Record<string, Route>): jest.Mock {
  const fn = jest.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const route = routes[`${init?.method ?? 'GET'} ${url.pathname}`];
    if (!route) throw new Error(`Unmocked request: ${init?.method ?? 'GET'} ${url.pathname}`);
    return route(url, init);
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

export function envelope(code: string, message: string, status: number): Response {
  return jsonResponse({ error: { code, message, request_id: 'rid', details: {} } }, status);
}
