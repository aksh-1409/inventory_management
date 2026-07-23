import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, hasScope } from '@/lib/api-auth';
import { createApiKeySchema } from '@/lib/schemas';
import crypto from 'crypto';
import { auditLog } from '@/lib/audit';

function generateApiKey(): string {
  const raw = crypto.randomBytes(32).toString('hex');
  return `sp_live_${raw}`;
}

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (!authResult) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { user } = authResult;
    if (!hasScope(user, 'api-keys:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const keys = await prisma.apiKey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ keys });
  } catch (error) {
    console.error('[API_KEYS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (!authResult) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { user } = authResult;
    if (!hasScope(user, 'api-keys:write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const result = createApiKeySchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { name, scopes, expiresInDays } = result.data;
    const rawKey = generateApiKey();
    const keyHash = hashKey(rawKey);

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const apiKey = await prisma.apiKey.create({
      data: {
        name,
        keyHash,
        userId: user.id,
        scopes,
        expiresAt,
      },
    });
    await auditLog(user.id, 'ApiKey', apiKey.id, 'CREATE', { after: apiKey });

    return NextResponse.json(
      {
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          keyPreview: `sp_live_${keyHash.substring(0, 8)}`,
          scopes: apiKey.scopes,
          isActive: apiKey.isActive,
          expiresAt: apiKey.expiresAt?.toISOString() || null,
          createdAt: apiKey.createdAt.toISOString(),
        },
        key: rawKey,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API_KEYS_POST_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
