import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { episodeLaunchPackageService, launchPackageParamsSchema } from '@/lib/launch';

export async function GET(request: Request, { params }: { params: Promise<{ id: string; episodeId: string; packageId: string }> }) { try { const { user } = await requireUser(); const value = launchPackageParamsSchema.parse(await params); return NextResponse.json({ data: await episodeLaunchPackageService.get(user, value.id, value.episodeId, value.packageId) }, { headers: { 'cache-control': 'no-store' } }); } catch (error) { return apiError(error, 'LAUNCH_PACKAGE_FAILED', 'Unable to load launch package', request); } }
