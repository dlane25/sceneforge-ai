import { Prisma } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiError } from '@/lib/api';
import { InvalidStateError } from '@/lib/application-errors';

describe('API error mapping', () => {
  afterEach(() => vi.restoreAllMocks());

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

  it.each([
    ['P2002', { modelName: 'Scene', target: ['episodeId', 'sceneNumber'], cause: 'database-password' }, { modelName: 'Scene', target: ['episodeId', 'sceneNumber'] }],
    ['P2003', { modelName: 'Scene', field_name: 'Scene_locationId_fkey', query: 'sensitive-query' }, { modelName: 'Scene', field_name: 'Scene_locationId_fkey' }],
    ['P2022', { modelName: 'Scene', column: 'Scene.locationId', value: 'sensitive-value' }, { modelName: 'Scene', column: 'Scene.locationId' }],
  ] as const)('logs sanitized %s diagnostics while preserving the generic client response', async (code, meta, expectedMeta) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Prisma.PrismaClientKnownRequestError('sensitive Prisma message and SQL', { code, clientVersion: '6.19.0', meta });
    const response = await apiError(error, 'SCENE_CREATE_FAILED', 'Unable to create scene', new Request('https://app.example/api/test', { headers: { 'x-request-id': `request_${code}` } }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: { code: 'SCENE_CREATE_FAILED', message: 'Unable to create scene', requestId: `request_${code}` } });
    expect(log).toHaveBeenCalledOnce();
    const entry = JSON.parse(String(log.mock.calls[0][0]));
    expect(entry).toMatchObject({ requestId: `request_${code}`, errorCode: 'SCENE_CREATE_FAILED', prismaCode: code, prismaMeta: expectedMeta });
    expect(JSON.stringify(entry)).not.toContain('sensitive');
    expect(entry).not.toHaveProperty('message');
    expect(entry).not.toHaveProperty('stack');
    expect(entry.prismaMeta).not.toHaveProperty('cause');
    expect(entry.prismaMeta).not.toHaveProperty('query');
    expect(entry.prismaMeta).not.toHaveProperty('value');
  });

  it('logs only safe classification for Prisma validation errors and does not infer a lifecycle conflict from the message', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Prisma.PrismaClientValidationError('approval promptSnapshot database-value', { clientVersion: '6.19.0' });
    const response = await apiError(error, 'GENERATION_PREPARE_FAILED', 'Unable to prepare generation', new Request('https://app.example/api/test', { headers: { 'x-request-id': 'request_prisma_validation' } }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: { code: 'GENERATION_PREPARE_FAILED', message: 'Unable to prepare generation', requestId: 'request_prisma_validation' } });
    const entry = JSON.parse(String(log.mock.calls[0][0]));
    expect(entry).toMatchObject({ requestId: 'request_prisma_validation', errorCode: 'GENERATION_PREPARE_FAILED', prismaErrorType: 'validation' });
    expect(entry).not.toHaveProperty('prismaCode');
    expect(entry).not.toHaveProperty('prismaMeta');
    expect(entry).not.toHaveProperty('message');
    expect(entry).not.toHaveProperty('stack');
    expect(JSON.stringify(entry)).not.toContain('approval');
    expect(JSON.stringify(entry)).not.toContain('promptSnapshot');
    expect(JSON.stringify(entry)).not.toContain('database-value');
  });

  it('maps only explicit application lifecycle conflicts to 409', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const request = new Request('https://app.example/api/test', { headers: { 'x-request-id': 'request_explicit_state' } });
    const response = await apiError(new InvalidStateError('Generation job is not awaiting approval'), 'GENERATION_START_FAILED', 'Unable to start generation', request);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: { code: 'INVALID_STATE', message: 'The requested operation is not valid in the current state', requestId: 'request_explicit_state' } });

    const accidental = await apiError(new Error('infrastructure approval state failed'), 'GENERATION_START_FAILED', 'Unable to start generation', new Request('https://app.example/api/test', { headers: { 'x-request-id': 'request_untyped_state' } }));
    expect(accidental.status).toBe(400);
  });
});
