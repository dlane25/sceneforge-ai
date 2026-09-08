import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { episodeExportService } from '@/lib/assembly';
import { exportActionBodySchema, exportActionParamsSchema } from '@/lib/assembly/api-schemas';
import { enforceCostlyAction } from '@/lib/security/rate-limit';

export async function POST(request: Request, { params }: { params: Promise<{ id: string; episodeId: string; jobId: string; action: string }> }) {
  try {
    const { user } = await requireUser(); const p = exportActionParamsSchema.parse(await params); const body = exportActionBodySchema.parse(await request.json().catch(() => ({})));
    if (p.action === 'start' || p.action === 'retry') await enforceCostlyAction(user.id, p.id, p.action === 'retry' ? 'retry' : 'export');
    if (p.action === 'approve') return NextResponse.json({ data: await episodeExportService.approve(user, p.id, p.episodeId, p.jobId, body.notes) });
    if (p.action === 'reject') { if (!body.notes) throw new Error('Export rejection notes are required'); return NextResponse.json({ data: await episodeExportService.reject(user, p.id, p.episodeId, p.jobId, body.notes) }); }
    if (p.action === 'start') return NextResponse.json({ data: await episodeExportService.start(user, p.id, p.episodeId, p.jobId) });
    if (p.action === 'refresh') return NextResponse.json({ data: await episodeExportService.refresh(user, p.id, p.episodeId, p.jobId) });
    if (p.action === 'retry') return NextResponse.json({ data: await episodeExportService.retry(user, p.id, p.episodeId, p.jobId) });
    return NextResponse.json({ data: await episodeExportService.cancel(user, p.id, p.episodeId, p.jobId) });
  } catch (error) { return apiError(error, 'EXPORT_ACTION_FAILED', 'Unable to update episode export', request); }
}
