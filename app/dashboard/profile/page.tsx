import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ProfileClient from './ProfileClient'

async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { warehouse: true },
  })

  if (!user) return null

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    warehouseName: user.warehouse?.name ?? null,
    createdAt: user.createdAt.toISOString(),
    hasPassword: user.passwordHash.length > 0,
    passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
  }
}

export default async function ProfilePage() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  const profile = await getProfile(session.user.id)
  if (!profile) redirect('/auth/login')

  return <ProfileClient profile={profile} />
}
