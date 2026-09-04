import { NextResponse } from 'next/server';
import { orchestrationService } from '@/lib/orchestration';
import { orchestrateRequestSchema } from '@/lib/validation/agent-schemas';

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json().catch(() => ({}));
    const parsed = orchestrateRequestSchema.parse(body);
    const result = await orchestrationService.run(parsed.episodeId);
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: { code: 'ORCHESTRATION_FAILED', message: error instanceof Error ? error.message : 'Unable to orchestrate series' } }, { status: 400 });
  }
}
