import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { productionService } from '@/lib/series';
import { episodeInputSchema } from '@/lib/validation/schemas';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { user } = await requireUser(); return NextResponse.json({ data: await productionService.listEpisodes(user, (await params).id) }); } catch (error) { return apiError(error, 'EPISODES_LIST_FAILED', 'Unable to list episodes'); } }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { user } = await requireUser(); return NextResponse.json({ data: await productionService.createEpisode(user, (await params).id, episodeInputSchema.parse(await request.json())) }, { status: 201 }); } catch (error) { return apiError(error, 'EPISODE_CREATE_FAILED', 'Unable to create episode'); } }
