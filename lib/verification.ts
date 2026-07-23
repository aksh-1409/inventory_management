import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

const VERIFICATION_TOKEN_TTL = 60 * 60 * 1000; // 1 hour

export async function createVerificationToken(email: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + VERIFICATION_TOKEN_TTL);

  await prisma.verificationToken.upsert({
    where: { identifier: email },
    update: { token, expires },
    create: { identifier: email, token, expires },
  });

  return token;
}

export async function verifyEmail(token: string): Promise<{ success: boolean; error?: string }> {
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record) return { success: false, error: 'Invalid or expired verification link.' };
  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { identifier: record.identifier } });
    return { success: false, error: 'Verification link has expired. Please request a new one.' };
  }

  await prisma.user.update({
    where: { email: record.identifier },
    data: { emailVerified: new Date() },
  });
  await prisma.verificationToken.delete({ where: { identifier: record.identifier } });

  return { success: true };
}

export async function isEmailVerified(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  });
  return user?.emailVerified !== null && user?.emailVerified !== undefined;
}
