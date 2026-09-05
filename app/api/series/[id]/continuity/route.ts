import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { productionService } from '@/lib/series';
import { storyFactInputSchema } from '@/lib/validation/schemas';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { user } = await requireUser(); return NextResponse.json({ data: await productionService.listStoryFacts(user, (await params).id) }); } catch (error) { return apiError(error, 'FACTS_LIST_FAILED', 'Unable to list continuity facts'); } }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { user } = await requireUser(); return NextResponse.json({ data: await productionService.createStoryFact(user, (await params).id, storyFactInputSchema.parse(await request.json())) }, { status: 201 }); } catch (error) { return apiError(error, 'FACT_CREATE_FAILED', 'Unable to create continuity fact'); } }
