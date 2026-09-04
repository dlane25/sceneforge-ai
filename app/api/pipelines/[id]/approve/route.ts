import { NextResponse } from 'next/server';
import { orchestrationService } from '@/lib/orchestration';
import { approvalRequestSchema } from '@/lib/validation/agent-schemas';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const parsed = approvalRequestSchema.parse(await request.json().catch(() => ({}))); const result = orchestrationService.approve((await params).id, parsed.note); const queued = await orchestrationService.queueGeneration(result.id); return NextResponse.json({ data: queued }); }
  catch (error) { return NextResponse.json({ error: { code: 'APPROVAL_FAILED', message: error instanceof Error ? error.message : 'Approval failed' } }, { status: 400 }); }
}
