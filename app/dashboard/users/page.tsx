import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { parsePagination, parseSearch } from '@/lib/pagination';
import { UserRole } from '@/lib/generated/prisma/enums';
import UsersClient from './UsersClient';

export default async function UsersPage(props: {
  searchParams?: Promise<{ q?: string; page?: string; pageSize?: string }>;
}) {
  const session = await auth();
  if (!session) redirect('/auth/login');
  if (session.user.role !== 'ADMIN') redirect('/dashboard');

  const searchParams = new URLSearchParams();
  const sp = await props.searchParams;
  if (sp?.q) searchParams.set('q', sp.q);
  if (sp?.page) searchParams.set('page', sp.page);
  if (sp?.pageSize) searchParams.set('pageSize', sp.pageSize);

  const q = parseSearch(searchParams);
  const { page, pageSize, skip, take } = parsePagination(searchParams, { page: 1, pageSize: 100 });

  const roleFilter =
    q.toUpperCase() === 'ADMIN'
      ? UserRole.ADMIN
      : q.toUpperCase() === 'OPERATOR'
        ? UserRole.OPERATOR
        : undefined;
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
          ...(roleFilter ? [{ role: roleFilter }] : []),
        ],
      }
    : {};

  const [rawUsers, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take,
      where,
      include: { warehouse: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  const users = rawUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    warehouse: (u as { warehouse: { id: string; name: string } | null }).warehouse,
    createdAt: u.createdAt.toISOString(),
  }));

  return <UsersClient initialUsers={users} currentUserId={session.user.id} />;
}
