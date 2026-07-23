import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { CommandPalette } from '@/components/CommandPalette';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/auth/login');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Sidebar />
      <main className="main-content" style={{ flex: 1 }}>
        <div className="page-wrapper">{children}</div>
      </main>
      <CommandPalette isAdmin={session.user?.role === 'ADMIN'} />
    </div>
  );
}
