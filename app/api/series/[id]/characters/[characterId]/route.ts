import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { productionService } from '@/lib/series';
import { characterPatchSchema } from '@/lib/validation/schemas';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; characterId: string }> }) { try { const { user } = await requireUser(); const { id, characterId } = await params; const value = await productionService.listCharacters(user, id); const character = value.find((item) => item.id === characterId); if (!character) throw new Error(`Character ${characterId} was not found`); return NextResponse.json({ data: character }); } catch (error) { return apiError(error, 'CHARACTER_GET_FAILED', 'Unable to load character'); } }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; characterId: string }> }) { try { const { user } = await requireUser(); const { id, characterId } = await params; return NextResponse.json({ data: await productionService.updateCharacter(user, id, characterId, characterPatchSchema.parse(await request.json())) }); } catch (error) { return apiError(error, 'CHARACTER_UPDATE_FAILED', 'Unable to update character'); } }
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; characterId: string }> }) { try { const { user } = await requireUser(); const { id, characterId } = await params; await productionService.deleteCharacter(user, id, characterId); return new NextResponse(null, { status: 204 }); } catch (error) { return apiError(error, 'CHARACTER_DELETE_FAILED', 'Unable to delete character'); } }
