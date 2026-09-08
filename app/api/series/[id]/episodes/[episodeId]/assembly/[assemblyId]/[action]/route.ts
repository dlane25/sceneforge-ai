import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { episodeAssemblyService } from '@/lib/assembly';
import { assemblyActionBodySchema, assemblyActionParamsSchema } from '@/lib/assembly/api-schemas';

export async function POST(request: Request, { params }: { params: Promise<{ id: string; episodeId: string; assemblyId: string; action: string }> }) {
  try {
    const { user } = await requireUser(); const p = assemblyActionParamsSchema.parse(await params); const body = assemblyActionBodySchema.parse(await request.json().catch(() => ({})));
    if (p.action === 'validate') return NextResponse.json({ data: await episodeAssemblyService.validate(user, p.id, p.episodeId, p.assemblyId) });
    if (p.action === 'approve') return NextResponse.json({ data: await episodeAssemblyService.approve(user, p.id, p.episodeId, p.assemblyId, body.notes) });
    if (p.action === 'reject') { if (!body.notes) throw new Error('Assembly rejection notes are required'); return NextResponse.json({ data: await episodeAssemblyService.reject(user, p.id, p.episodeId, p.assemblyId, body.notes) }); }
    if (p.action === 'preferred') return NextResponse.json({ data: await episodeAssemblyService.setPreferred(user, p.id, p.episodeId, p.assemblyId) });
    return NextResponse.json({ data: await episodeAssemblyService.build(user, p.id, p.episodeId, p.assemblyId) }, { status: 201 });
  } catch (error) { return apiError(error, 'ASSEMBLY_ACTION_FAILED', 'Unable to update episode assembly'); }
}
