import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { episodeLaunchPackageService, episodeLaunchParamsSchema } from '@/lib/launch';

type Context = { params: Promise<{ id: string; episodeId: string }> };
export async function GET(request: Request, { params }: Context) { try { const { user } = await requireUser(); const value = episodeLaunchParamsSchema.parse(await params); return NextResponse.json({ data: await episodeLaunchPackageService.list(user, value.id, value.episodeId) }, { headers: { 'cache-control': 'no-store' } }); } catch (error) { return apiError(error, 'LAUNCH_PACKAGES_FAILED', 'Unable to load launch packages', request); } }
export async function POST(request: Request, { params }: Context) { try { const { user } = await requireUser(); const value = episodeLaunchParamsSchema.parse(await params); return NextResponse.json({ data: await episodeLaunchPackageService.prepare(user, value.id, value.episodeId) }, { status: 201 }); } catch (error) { return apiError(error, 'LAUNCH_PACKAGE_PREPARE_FAILED', 'Unable to prepare launch package', request); } }
