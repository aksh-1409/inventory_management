import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, hasScope } from '@/lib/api-auth';
import { supplierUpdateSchema } from '@/lib/schemas';
import { auditLog } from '@/lib/audit';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = authResult;

    const { id } = await ctx.params;
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier || supplier.deletedAt) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    return NextResponse.json({ supplier });
  } catch (error) {
    console.error('[SUPPLIER_GET_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = authResult;
    if (!hasScope(user, 'suppliers:write') || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await ctx.params;
    const body = await req.json();
    const result = supplierUpdateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const supplier = await prisma.supplier.update({ where: { id }, data: result.data });
    await auditLog(user.id, 'Supplier', id, 'UPDATE', { before: existing, after: supplier });
    return NextResponse.json({ supplier });
  } catch (error) {
    console.error('[SUPPLIER_PATCH_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req);
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = authResult;
    if (!hasScope(user, 'suppliers:write') || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await ctx.params;
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    await prisma.supplier.update({ where: { id }, data: { deletedAt: new Date() } });
    await auditLog(user.id, 'Supplier', id, 'DELETE');
    return NextResponse.json({ message: 'Supplier deleted' });
  } catch (error) {
    console.error('[SUPPLIER_DELETE_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
