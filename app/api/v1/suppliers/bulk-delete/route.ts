import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, hasScope } from '@/lib/api-auth';
import { auditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (!authResult) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user } = authResult;
    if (!hasScope(user, 'admin') || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    let ids: string[] = [];

    if (body.allMatching && body.searchParams) {
      const query = body.searchParams;
      const matching = await prisma.supplier.findMany({
        where: {
          deletedAt: null,
          ...(query
            ? {
                OR: [
                  { name: { contains: query, mode: 'insensitive' as const } },
                  { contactName: { contains: query, mode: 'insensitive' as const } },
                  { email: { contains: query, mode: 'insensitive' as const } },
                ],
              }
            : {}),
        },
        select: { id: true },
      });
      ids = matching.map((s) => s.id);
    } else if (Array.isArray(body.ids)) {
      ids = body.ids;
    }

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
    }

    const result = await prisma.supplier.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    for (const id of ids) {
      await auditLog(user.id, 'Supplier', id, 'DELETE');
    }

    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error('[SUPPLIER_BULK_DELETE_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
