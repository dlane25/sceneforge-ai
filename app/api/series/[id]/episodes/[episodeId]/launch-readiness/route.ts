import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { episodeLaunchParamsSchema, productionReadinessService } from '@/lib/launch';

export async function GET(request: Request, { params }: { params: Promise<{ id: string; episodeId: string }> }) { try { const { user } = await requireUser(); const value = episodeLaunchParamsSchema.parse(await params); return NextResponse.json({ data: await productionReadinessService.episode(user, value.id, value.episodeId) }, { headers: { 'cache-control': 'no-store' } }); } catch (error) { return apiError(error, 'EPISODE_READINESS_FAILED', 'Unable to assess episode launch readiness', request); } }
