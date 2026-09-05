import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { productionService } from '@/lib/series';
import { memberInputSchema } from '@/lib/validation/schemas';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { user } = await requireUser(); return NextResponse.json({ data: await productionService.listMembers(user, (await params).id) }); }
  catch (error) { return apiError(error, 'MEMBERS_LIST_FAILED', 'Unable to list members'); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { user } = await requireUser(); const input = memberInputSchema.parse(await request.json()); return NextResponse.json({ data: await productionService.addMember(user, (await params).id, input) }, { status: 201 }); }
  catch (error) { return apiError(error, 'MEMBER_ADD_FAILED', 'Unable to add member'); }
}
