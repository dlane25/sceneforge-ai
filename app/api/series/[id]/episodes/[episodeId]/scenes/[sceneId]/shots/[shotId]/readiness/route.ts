import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { productionService } from '@/lib/series';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; episodeId: string; sceneId: string; shotId: string }> }) { try { const { user } = await requireUser(); const { id, episodeId, sceneId, shotId } = await params; return NextResponse.json({ data: await productionService.getShotReadiness(user, id, episodeId, sceneId, shotId) }); } catch (error) { return apiError(error, 'SHOT_READINESS_FAILED', 'Unable to evaluate shot readiness'); } }
