import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { episodeAssemblyService } from '@/lib/assembly';
import { assemblyIdParamsSchema } from '@/lib/assembly/api-schemas';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; episodeId: string; assemblyId: string }> }) { try { const { user } = await requireUser(); const p = assemblyIdParamsSchema.parse(await params); return NextResponse.json({ data: await episodeAssemblyService.get(user, p.id, p.episodeId, p.assemblyId) }); } catch (error) { return apiError(error, 'ASSEMBLY_READ_FAILED', 'Unable to load episode assembly'); } }
