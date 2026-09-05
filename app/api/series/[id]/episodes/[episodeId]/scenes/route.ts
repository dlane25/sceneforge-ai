import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { productionService } from '@/lib/series';
import { sceneInputSchema } from '@/lib/validation/schemas';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; episodeId: string }> }) { try { const { user } = await requireUser(); const { id, episodeId } = await params; return NextResponse.json({ data: await productionService.listScenes(user, id, episodeId) }); } catch (error) { return apiError(error, 'SCENES_LIST_FAILED', 'Unable to list scenes'); } }
export async function POST(request: Request, { params }: { params: Promise<{ id: string; episodeId: string }> }) { try { const { user } = await requireUser(); const { id, episodeId } = await params; return NextResponse.json({ data: await productionService.createScene(user, id, episodeId, sceneInputSchema.parse(await request.json())) }, { status: 201 }); } catch (error) { return apiError(error, 'SCENE_CREATE_FAILED', 'Unable to create scene'); } }
