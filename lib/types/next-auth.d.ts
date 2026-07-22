// Extend NextAuth types to include custom fields on session and JWT
import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: 'ADMIN' | 'OPERATOR'
      warehouseId: string | null
      warehouseName: string | null
      emailVerifiedAt: string | null
      passwordSetAt: string | null
    }
  }

  interface User {
    id: string
    name: string
    email: string
    role: 'ADMIN' | 'OPERATOR'
    warehouseId: string | null
    warehouseName: string | null
    passwordSetAt: Date | string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: 'ADMIN' | 'OPERATOR'
    warehouseId: string | null
    warehouseName: string | null
    emailVerifiedAt: string | null
    passwordSetAt: string | null
  }
}
