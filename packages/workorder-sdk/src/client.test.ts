import { describe, expect, it } from 'vitest';
import { WorkorderClient } from './client.js';

describe('WorkorderClient', () => {
  it('builds authorization headers', async () => {
    const calls: RequestInit[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, init) => {
      calls.push(init ?? {});
      return new Response(JSON.stringify({ code: 0, message: 'ok', data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new WorkorderClient({
      baseUrl: 'http://localhost:3000/api/v1',
      token: 'test-token',
      userId: 'user_resident',
    });
    await client.listTypes();

    expect(calls[0]?.headers).toMatchObject({
      Authorization: 'Bearer test-token',
      'X-User-Id': 'user_resident',
    });

    globalThis.fetch = originalFetch;
  });
});
