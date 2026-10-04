import { RequireAuth } from '@/components/RequireAuth';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="container page" style={{ maxWidth: 1100 }}>
      <RequireAuth>{children}</RequireAuth>
    </main>
  );
}
