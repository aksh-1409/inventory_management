import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, hasScope } from '@/lib/api-auth';
import { auditLog } from '@/lib/audit';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = authResult;
    if (!hasScope(user, 'customers:write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await ctx.params;
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }
    if (!existing.deletedAt) {
      return NextResponse.json({ error: 'Customer is not deleted' }, { status: 400 });
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: { deletedAt: null },
    });
    await auditLog(user.id, 'Customer', id, 'RESTORE');

    return NextResponse.json({ customer });
  } catch (error) {
    console.error('[CUSTOMER_RESTORE_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
