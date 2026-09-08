import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { episodeAssemblyService } from '@/lib/assembly';
import { assemblyBuildSchema, episodeAssemblyParamsSchema } from '@/lib/assembly/api-schemas';

type Context = { params: Promise<{ id: string; episodeId: string }> };
export async function GET(_request: Request, { params }: Context) { try { const { user } = await requireUser(); const p = episodeAssemblyParamsSchema.parse(await params); return NextResponse.json({ data: await episodeAssemblyService.list(user, p.id, p.episodeId) }); } catch (error) { return apiError(error, 'ASSEMBLY_LIST_FAILED', 'Unable to load episode assemblies'); } }
export async function POST(request: Request, { params }: Context) { try { const { user } = await requireUser(); const p = episodeAssemblyParamsSchema.parse(await params); const input = assemblyBuildSchema.parse(await request.json().catch(() => ({}))); return NextResponse.json({ data: await episodeAssemblyService.build(user, p.id, p.episodeId, input.rebuiltFromAssemblyId) }, { status: 201 }); } catch (error) { return apiError(error, 'ASSEMBLY_BUILD_FAILED', 'Unable to build episode assembly'); } }
