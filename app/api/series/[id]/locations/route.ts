import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { productionService } from '@/lib/series';
import { locationInputSchema } from '@/lib/validation/schemas';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { user } = await requireUser(); return NextResponse.json({ data: await productionService.listLocations(user, (await params).id) }); } catch (error) { return apiError(error, 'LOCATIONS_LIST_FAILED', 'Unable to list locations'); } }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { user } = await requireUser(); return NextResponse.json({ data: await productionService.createLocation(user, (await params).id, locationInputSchema.parse(await request.json())) }, { status: 201 }); } catch (error) { return apiError(error, 'LOCATION_CREATE_FAILED', 'Unable to create location'); } }
