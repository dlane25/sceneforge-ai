import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { operationsQuerySchema, operationsService } from '@/lib/launch';

export async function GET(request: Request) { try { const { user } = await requireUser(); const url = new URL(request.url); const { seriesId } = operationsQuerySchema.parse({ seriesId: url.searchParams.get('seriesId') || undefined }); return NextResponse.json({ data: await operationsService.list(user, seriesId) }, { headers: { 'cache-control': 'no-store' } }); } catch (error) { return apiError(error, 'OPERATIONS_FAILED', 'Unable to load production operations', request); } }
