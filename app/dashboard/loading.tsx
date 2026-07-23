import { SkeletonCard, SkeletonRow } from '@/components/ui/Skeleton';

export default function DashboardLoading() {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ width: 120, height: 28, borderRadius: 6, background: 'var(--skeleton)' }} />
          <div
            style={{
              width: 80,
              height: 14,
              borderRadius: 4,
              background: 'var(--skeleton)',
              marginTop: 8,
            }}
          />
        </div>
      </div>
      <div
        className="card"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 16,
          padding: 20,
        }}
      >
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="card" style={{ marginTop: 24, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </tbody>
        </table>
      </div>
    </div>
  );
}
