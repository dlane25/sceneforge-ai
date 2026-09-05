import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { productionService } from '@/lib/series';
import { productionPatchSchema } from '@/lib/validation/schemas';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { user } = await requireUser(); return NextResponse.json({ data: await productionService.getSeries(user, (await params).id) }); }
  catch (error) { return apiError(error, 'SERIES_GET_FAILED', 'Unable to load production'); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { user } = await requireUser(); const input = productionPatchSchema.parse(await request.json()); return NextResponse.json({ data: await productionService.updateSeries(user, (await params).id, input) }); }
  catch (error) { return apiError(error, 'SERIES_UPDATE_FAILED', 'Unable to update production'); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { user } = await requireUser(); return NextResponse.json({ data: await productionService.archiveSeries(user, (await params).id) }); }
  catch (error) { return apiError(error, 'SERIES_ARCHIVE_FAILED', 'Unable to archive production'); }
}
