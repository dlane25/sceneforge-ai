import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { productionService } from '@/lib/series';
import { storyFactPatchSchema } from '@/lib/validation/schemas';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; factId: string }> }) { try { const { user } = await requireUser(); const { id, factId } = await params; const value = (await productionService.listStoryFacts(user, id)).find((item) => item.id === factId); if (!value) throw new Error(`Story fact ${factId} was not found`); return NextResponse.json({ data: value }); } catch (error) { return apiError(error, 'FACT_GET_FAILED', 'Unable to load continuity fact'); } }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; factId: string }> }) { try { const { user } = await requireUser(); const { id, factId } = await params; return NextResponse.json({ data: await productionService.updateStoryFact(user, id, factId, storyFactPatchSchema.parse(await request.json())) }); } catch (error) { return apiError(error, 'FACT_UPDATE_FAILED', 'Unable to update continuity fact'); } }
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; factId: string }> }) { try { const { user } = await requireUser(); const { id, factId } = await params; await productionService.deleteStoryFact(user, id, factId); return new NextResponse(null, { status: 204 }); } catch (error) { return apiError(error, 'FACT_DELETE_FAILED', 'Unable to delete continuity fact'); } }
