import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { parsePagination, parseSearch } from '@/lib/pagination';
import ApiKeysClient from './ApiKeysClient';

export default async function ApiKeysPage(props: {
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
  const { page, pageSize, skip, take } = parsePagination(searchParams, { page: 1, pageSize: 50 });

  const where = {
    userId: session.user.id,
    ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
  };

  const [rawKeys, total] = await Promise.all([
    prisma.apiKey.findMany({ skip, take, where, orderBy: { createdAt: 'desc' } }),
    prisma.apiKey.count({ where }),
  ]);

  const keys = rawKeys.map((k) => ({
    id: k.id,
    name: k.name,
    keyPreview: `sp_live_${k.keyHash.substring(0, 8)}`,
    scopes: k.scopes,
    isActive: k.isActive,
    lastUsedAt: k.lastUsedAt?.toISOString() || null,
    expiresAt: k.expiresAt?.toISOString() || null,
    createdAt: k.createdAt.toISOString(),
  }));

  return <ApiKeysClient initialKeys={keys} total={total} page={page} pageSize={pageSize} />;
}
