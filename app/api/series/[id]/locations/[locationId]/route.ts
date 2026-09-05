import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { productionService } from '@/lib/series';
import { locationPatchSchema } from '@/lib/validation/schemas';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; locationId: string }> }) { try { const { user } = await requireUser(); const { id, locationId } = await params; const value = (await productionService.listLocations(user, id)).find((item) => item.id === locationId); if (!value) throw new Error(`Location ${locationId} was not found`); return NextResponse.json({ data: value }); } catch (error) { return apiError(error, 'LOCATION_GET_FAILED', 'Unable to load location'); } }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; locationId: string }> }) { try { const { user } = await requireUser(); const { id, locationId } = await params; return NextResponse.json({ data: await productionService.updateLocation(user, id, locationId, locationPatchSchema.parse(await request.json())) }); } catch (error) { return apiError(error, 'LOCATION_UPDATE_FAILED', 'Unable to update location'); } }
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; locationId: string }> }) { try { const { user } = await requireUser(); const { id, locationId } = await params; await productionService.deleteLocation(user, id, locationId); return new NextResponse(null, { status: 204 }); } catch (error) { return apiError(error, 'LOCATION_DELETE_FAILED', 'Unable to delete location'); } }
