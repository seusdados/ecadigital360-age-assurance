export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        <div className="h-7 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-muted/70" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-md bg-card"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-md bg-card"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
