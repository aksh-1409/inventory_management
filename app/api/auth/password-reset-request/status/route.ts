import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashResetSecret, parseResetCookie, RESET_REQUEST_COOKIE } from '@/lib/password-reset';

export async function GET(req: NextRequest) {
  const credential = parseResetCookie(req.cookies.get(RESET_REQUEST_COOKIE)?.value);
  if (!credential) return NextResponse.json({ status: 'EXPIRED' });

  const request = await prisma.passwordResetRequest.findUnique({
    where: { id: credential.requestId },
  });
  if (!request || request.requestSecretHash !== hashResetSecret(credential.secret)) {
    return NextResponse.json({ status: 'PENDING' });
  }

  if (request.expiresAt <= new Date() && ['PENDING', 'APPROVED'].includes(request.status)) {
    await prisma.passwordResetRequest.update({
      where: { id: request.id },
      data: { status: 'EXPIRED' },
    });
    return NextResponse.json({ status: 'EXPIRED' });
  }

  return NextResponse.json({ status: request.status, expiresAt: request.expiresAt.toISOString() });
}
