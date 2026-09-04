import { NextResponse } from 'next/server';
import { orchestrationService } from '@/lib/orchestration';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await orchestrationService.run(id);
  return NextResponse.json({ data: result.shotPlan, pipeline: result.id, state: result.state });
}
