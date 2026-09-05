import { NextResponse } from 'next/server';
import { ensureDemoMembership, requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { productionService } from '@/lib/series';
import { productionInputSchema } from '@/lib/validation/schemas';

export async function GET() {
  try { const { user } = await requireUser(); await ensureDemoMembership('series_empire_of_lies'); return NextResponse.json({ data: await productionService.listAccessibleSeries(user) }); }
  catch (error) { return apiError(error, 'SERIES_LIST_FAILED', 'Unable to list productions'); }
}

export async function POST(request: Request) {
  try { const { user } = await requireUser(); const input = productionInputSchema.parse(await request.json()); return NextResponse.json({ data: await productionService.createSeries(user, input) }, { status: 201 }); }
  catch (error) { return apiError(error, 'SERIES_CREATE_FAILED', 'Unable to create production'); }
}
