import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const requests = await prisma.passwordResetRequest.findMany({
    where: { status: 'PENDING', expiresAt: { gt: new Date() }, user: { role: 'OPERATOR' } },
    include: {
      user: { select: { name: true, email: true, warehouse: { select: { name: true } } } },
    },
    orderBy: { requestedAt: 'desc' },
  });

  return NextResponse.json({
    requests: requests.map((request) => ({
      id: request.id,
      operatorName: request.user.name,
      operatorEmail: request.user.email,
      warehouseName: request.user.warehouse?.name ?? null,
      requestedAt: request.requestedAt.toISOString(),
      expiresAt: request.expiresAt.toISOString(),
    })),
  });
}
