import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { parsePagination, parseSearch } from '@/lib/pagination';
import CustomersClient from './CustomersClient';

export default async function CustomersPage(props: {
  searchParams?: Promise<{ q?: string; page?: string; pageSize?: string; showDeleted?: string }>;
}) {
  const session = await auth();
  if (!session) redirect('/auth/login');

  const searchParams = new URLSearchParams();
  const sp = await props.searchParams;
  if (sp?.q) searchParams.set('q', sp.q);
  if (sp?.page) searchParams.set('page', sp.page);
  if (sp?.pageSize) searchParams.set('pageSize', sp.pageSize);
  if (sp?.showDeleted) searchParams.set('showDeleted', sp.showDeleted);

  const q = parseSearch(searchParams);
  const { page, pageSize, skip, take } = parsePagination(searchParams);
  const showDeleted = sp?.showDeleted === '1';

  const where = {
    ...(showDeleted ? {} : { deletedAt: null }),
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

  const [rawCustomers, total] = await Promise.all([
    prisma.customer.findMany({ skip, take, where, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
    prisma.customer.count({ where }),
  ]);

  const customers = rawCustomers.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    deletedAt: c.deletedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <CustomersClient
      initialCustomers={customers}
      total={total}
      page={page}
      pageSize={pageSize}
      userRole={session.user.role}
      showDeleted={showDeleted}
    />
  );
}
