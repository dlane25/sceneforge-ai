import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { episodeExportService } from '@/lib/assembly';
import { episodeAssemblyParamsSchema, exportCreateSchema } from '@/lib/assembly/api-schemas';
import { enforceCostlyAction } from '@/lib/security/rate-limit';

type Context = { params: Promise<{ id: string; episodeId: string }> };
export async function GET(_request: Request, { params }: Context) { try { const { user } = await requireUser(); const p = episodeAssemblyParamsSchema.parse(await params); return NextResponse.json({ data: await episodeExportService.list(user, p.id, p.episodeId) }); } catch (error) { return apiError(error, 'EXPORT_LIST_FAILED', 'Unable to load episode exports'); } }
export async function POST(request: Request, { params }: Context) { try { const { user } = await requireUser(); const p = episodeAssemblyParamsSchema.parse(await params); await enforceCostlyAction(user.id, p.id, 'export'); const input = exportCreateSchema.parse(await request.json()); return NextResponse.json({ data: await episodeExportService.create(user, p.id, p.episodeId, input.assemblyId, input.captionMode) }, { status: 201 }); } catch (error) { return apiError(error, 'EXPORT_CREATE_FAILED', 'Unable to prepare episode export', request); } }
