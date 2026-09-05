import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { apiError } from '@/lib/api';

describe('API error mapping', () => {
  it('returns structured validation errors without internal details', async () => {
    const response = apiError(z.object({ title: z.string() }).safeParse({}).error, 'BAD_INPUT', 'Validation failed');
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'VALIDATION_FAILED', message: 'Request validation failed' } });
  });

  it('sanitizes unknown internal errors', async () => {
    const response = apiError(new Error('database password leaked'), 'REQUEST_FAILED', 'Request failed');
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: { code: 'REQUEST_FAILED', message: 'Request failed' } });
  });
});
