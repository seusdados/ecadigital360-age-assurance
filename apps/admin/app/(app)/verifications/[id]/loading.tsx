export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="h-4 w-32 animate-pulse rounded bg-muted/70" />
      <div className="space-y-2">
        <div className="h-6 w-64 animate-pulse rounded bg-muted" />
        <div className="h-3 w-80 animate-pulse rounded bg-muted/70" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-lg bg-card"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
