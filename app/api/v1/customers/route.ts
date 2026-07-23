import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, hasScope } from '@/lib/api-auth';
import { customerSchema } from '@/lib/schemas';
import { parsePagination, parseSearch } from '@/lib/pagination';
import { auditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = parseSearch(searchParams);
    const { page, pageSize, skip, take } = parsePagination(searchParams);

    const where = {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { email: { contains: q, mode: 'insensitive' as const } },
              { phone: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({ skip, take, where, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
      prisma.customer.count({ where }),
    ]);

    return NextResponse.json({ customers, total, page, pageSize });
  } catch (error) {
    console.error('[CUSTOMERS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = authResult;

    if (!hasScope(user, 'customers:write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const result = customerSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    // Check duplicate phone
    const existing = await prisma.customer.findUnique({ where: { phone: result.data.phone } });
    if (existing) {
      return NextResponse.json(
        { error: 'A customer with this phone already exists.' },
        { status: 409 }
      );
    }

    const data = { ...result.data, email: result.data.email || null };
    const customer = await prisma.customer.create({ data });
    await auditLog(user.id, 'Customer', customer.id, 'CREATE', { after: customer });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    console.error('[CUSTOMERS_POST_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
