import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { productionService } from '@/lib/series';
import { characterInputSchema } from '@/lib/validation/schemas';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { user } = await requireUser(); return NextResponse.json({ data: await productionService.listCharacters(user, (await params).id) }); } catch (error) { return apiError(error, 'CHARACTERS_LIST_FAILED', 'Unable to list characters'); } }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { user } = await requireUser(); const input = characterInputSchema.parse(await request.json()); return NextResponse.json({ data: await productionService.createCharacter(user, (await params).id, input) }, { status: 201 }); } catch (error) { return apiError(error, 'CHARACTER_CREATE_FAILED', 'Unable to create character'); } }
