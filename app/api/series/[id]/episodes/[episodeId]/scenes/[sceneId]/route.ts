import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { productionService } from '@/lib/series';
import { scenePatchSchema } from '@/lib/validation/schemas';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; episodeId: string; sceneId: string }> }) { try { const { user } = await requireUser(); const { id, episodeId, sceneId } = await params; const value = (await productionService.listScenes(user, id, episodeId)).find((item) => item.id === sceneId); if (!value) throw new Error(`Scene ${sceneId} was not found`); return NextResponse.json({ data: value }); } catch (error) { return apiError(error, 'SCENE_GET_FAILED', 'Unable to load scene'); } }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; episodeId: string; sceneId: string }> }) { try { const { user } = await requireUser(); const { id, episodeId, sceneId } = await params; return NextResponse.json({ data: await productionService.updateScene(user, id, episodeId, sceneId, scenePatchSchema.parse(await request.json())) }); } catch (error) { return apiError(error, 'SCENE_UPDATE_FAILED', 'Unable to update scene'); } }
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; episodeId: string; sceneId: string }> }) { try { const { user } = await requireUser(); const { id, episodeId, sceneId } = await params; await productionService.deleteScene(user, id, episodeId, sceneId); return new NextResponse(null, { status: 204 }); } catch (error) { return apiError(error, 'SCENE_DELETE_FAILED', 'Unable to delete scene'); } }
