export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted/70" />
      </div>
      <div className="h-24 animate-pulse rounded-lg bg-card" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-md bg-card"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
