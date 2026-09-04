import { NextResponse } from 'next/server';
import { orchestrationService } from '@/lib/orchestration';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json({ data: orchestrationService.get((await params).id) }); }
  catch (error) { return NextResponse.json({ error: { code: 'PIPELINE_NOT_FOUND', message: error instanceof Error ? error.message : 'Pipeline not found' } }, { status: 404 }); }
}
