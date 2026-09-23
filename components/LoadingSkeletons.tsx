export function TaskViewSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line bg-subtle px-4 py-3">
        <div className="skeleton h-3 w-40" />
      </div>
      <div className="space-y-2 px-4 py-3">
        <div className="skeleton h-9 w-full" />
        <div className="skeleton h-9 w-full" />
        <div className="skeleton h-9 w-full" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 px-8 py-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-4">
            <div className="skeleton h-3 w-16" />
            <div className="mt-2 skeleton h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="card p-5">
        <div className="skeleton h-4 w-36" />
        <div className="mt-4 skeleton h-3 w-full" />
      </div>
    </div>
  );
}
