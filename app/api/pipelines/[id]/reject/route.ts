import { NextResponse } from 'next/server';
import { orchestrationService } from '@/lib/orchestration';
import { revisionRequestSchema } from '@/lib/validation/agent-schemas';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const parsed = revisionRequestSchema.parse(await request.json().catch(() => ({}))); return NextResponse.json({ data: orchestrationService.reject((await params).id, parsed.note) }); }
  catch (error) { return NextResponse.json({ error: { code: 'REJECTION_FAILED', message: error instanceof Error ? error.message : 'Rejection failed' } }, { status: 400 }); }
}
