import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { productionService } from '@/lib/series';
import { shotInputSchema } from '@/lib/validation/schemas';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; episodeId: string; sceneId: string }> }) { try { const { user } = await requireUser(); const { id, episodeId, sceneId } = await params; return NextResponse.json({ data: await productionService.listShots(user, id, episodeId, sceneId) }); } catch (error) { return apiError(error, 'SHOTS_LIST_FAILED', 'Unable to list shots'); } }
export async function POST(request: Request, { params }: { params: Promise<{ id: string; episodeId: string; sceneId: string }> }) { try { const { user } = await requireUser(); const { id, episodeId, sceneId } = await params; return NextResponse.json({ data: await productionService.createShot(user, id, episodeId, sceneId, shotInputSchema.parse(await request.json())) }, { status: 201 }); } catch (error) { return apiError(error, 'SHOT_CREATE_FAILED', 'Unable to create shot'); } }
