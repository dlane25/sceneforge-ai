import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { productionService } from '@/lib/series';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string; episodeId: string; sceneId: string; shotId: string }> }) { try { const { user } = await requireUser(); const { id, episodeId, sceneId, shotId } = await params; return NextResponse.json({ data: await productionService.createStoryboard(user, id, episodeId, sceneId, shotId) }, { status: 201 }); } catch (error) { return apiError(error, 'STORYBOARD_CREATE_FAILED', 'Unable to create storyboard placeholder'); } }
