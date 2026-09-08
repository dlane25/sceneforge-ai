import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { apiError } from '@/lib/api';

describe('API error mapping', () => {
  it('returns structured validation errors without internal details', async () => {
    const response = await apiError(z.object({ title: z.string() }).safeParse({}).error, 'BAD_INPUT', 'Validation failed', new Request('https://app.example/api/test', { headers: { 'x-request-id': 'request_validation' } }));
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'VALIDATION_FAILED', message: 'Request validation failed', requestId: 'request_validation' } });
  });

  it('sanitizes unknown internal errors', async () => {
    const response = await apiError(new Error('database password leaked'), 'REQUEST_FAILED', 'Request failed', new Request('https://app.example/api/test', { headers: { 'x-request-id': 'request_internal' } }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: { code: 'REQUEST_FAILED', message: 'Request failed', requestId: 'request_internal' } });
  });
});
