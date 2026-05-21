export function SkeletonBar({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-border-strong rounded ${className || ''}`} />;
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-wrap">
      <div className="px-3.5 py-2.5 border-b border-border flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBar key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-3.5 py-2.5 border-b border-border flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonBar key={c} className={`h-3 ${c === 0 ? 'flex-[2]' : 'flex-1'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded p-5 space-y-4">
      <div className="flex justify-between">
        <SkeletonBar className="h-5 w-40" />
        <SkeletonBar className="h-5 w-20" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <SkeletonBar className="h-12" />
        <SkeletonBar className="h-12" />
        <SkeletonBar className="h-12" />
        <SkeletonBar className="h-12" />
      </div>
    </div>
  );
}

export function SkeletonDetail() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-5">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div><SkeletonCard /></div>
    </div>
  );
}
