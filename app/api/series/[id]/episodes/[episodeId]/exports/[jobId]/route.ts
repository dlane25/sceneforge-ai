import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { episodeExportService } from '@/lib/assembly';
import { exportJobParamsSchema } from '@/lib/assembly/api-schemas';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; episodeId: string; jobId: string }> }) { try { const { user } = await requireUser(); const p = exportJobParamsSchema.parse(await params); return NextResponse.json({ data: await episodeExportService.get(user, p.id, p.episodeId, p.jobId) }); } catch (error) { return apiError(error, 'EXPORT_READ_FAILED', 'Unable to load episode export'); } }
