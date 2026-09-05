import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { productionService } from '@/lib/series';
import { episodePatchSchema } from '@/lib/validation/schemas';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; episodeId: string }> }) { try { const { user } = await requireUser(); const { id, episodeId } = await params; const value = (await productionService.listEpisodes(user, id)).find((item) => item.id === episodeId); if (!value) throw new Error(`Episode ${episodeId} was not found`); return NextResponse.json({ data: value }); } catch (error) { return apiError(error, 'EPISODE_GET_FAILED', 'Unable to load episode'); } }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; episodeId: string }> }) { try { const { user } = await requireUser(); const { id, episodeId } = await params; return NextResponse.json({ data: await productionService.updateEpisode(user, id, episodeId, episodePatchSchema.parse(await request.json())) }); } catch (error) { return apiError(error, 'EPISODE_UPDATE_FAILED', 'Unable to update episode'); } }
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; episodeId: string }> }) { try { const { user } = await requireUser(); const { id, episodeId } = await params; await productionService.deleteEpisode(user, id, episodeId); return new NextResponse(null, { status: 204 }); } catch (error) { return apiError(error, 'EPISODE_DELETE_FAILED', 'Unable to delete episode'); } }
