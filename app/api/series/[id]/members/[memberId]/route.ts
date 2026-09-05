import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { productionService } from '@/lib/series';
import { memberRoleSchema } from '@/lib/validation/schemas';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  try { const { user } = await requireUser(); const { id, memberId } = await params; const { role } = memberRoleSchema.parse(await request.json()); return NextResponse.json({ data: await productionService.updateMemberRole(user, id, memberId, role) }); }
  catch (error) { return apiError(error, 'MEMBER_UPDATE_FAILED', 'Unable to update member'); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  try { const { user } = await requireUser(); const { id, memberId } = await params; await productionService.removeMember(user, id, memberId); return new NextResponse(null, { status: 204 }); }
  catch (error) { return apiError(error, 'MEMBER_REMOVE_FAILED', 'Unable to remove member'); }
}
