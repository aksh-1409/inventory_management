import { NextRequest, NextResponse } from 'next/server'
import { verifyEmail, createVerificationToken } from '@/lib/verification'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'Missing verification token.' }, { status: 400 })
    }

    const result = await verifyEmail(token)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ message: 'Email verified successfully. You can now log in.' })
  } catch (error) {
    console.error('[VERIFY_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'No account found with this email.' }, { status: 404 })
    }
    if (user.emailVerified) {
      return NextResponse.json({ message: 'Email is already verified.' })
    }

    const token = await createVerificationToken(email)
    const verifyUrl = `${req.nextUrl.origin}/api/auth/verify?token=${token}`
    console.log(`[VERIFICATION] ${verifyUrl}`)

    return NextResponse.json({ message: 'Verification email sent.', devUrl: verifyUrl })
  } catch (error) {
    console.error('[VERIFY_RESEND_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
