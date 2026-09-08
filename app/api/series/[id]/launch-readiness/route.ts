import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { productionReadinessService, seriesLaunchParamsSchema } from '@/lib/launch';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { user } = await requireUser(); const { id } = seriesLaunchParamsSchema.parse(await params); const [application, series] = await Promise.all([Promise.resolve(productionReadinessService.application()), productionReadinessService.series(user, id)]); return NextResponse.json({ data: { application, series } }, { headers: { 'cache-control': 'no-store' } }); } catch (error) { return apiError(error, 'LAUNCH_READINESS_FAILED', 'Unable to assess launch readiness', request); } }
