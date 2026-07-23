import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, hasScope } from '@/lib/api-auth';
import { auditLog } from '@/lib/audit';

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = authResult;

    if (!hasScope(user, 'users:write') || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await ctx.params;

    if (id === user.id) {
      return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (existing.role === 'ADMIN') {
      return NextResponse.json({ error: 'Cannot delete another admin.' }, { status: 403 });
    }

    await prisma.user.delete({ where: { id } });
    await auditLog(user.id, 'User', id, 'DELETE');

    return NextResponse.json({ message: 'User deleted' });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error &&
      'code' in error &&
      (error as { code: string }).code === 'P2003'
    ) {
      return NextResponse.json(
        {
          error:
            'Cannot delete this user because they have related records (transactions, audit logs, etc.).',
        },
        { status: 409 }
      );
    }
    console.error('[USER_DELETE_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
