import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 font-medium tracking-tight',
        className,
      )}
    >
      <span
        aria-hidden
        className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground text-xs font-semibold"
      >
        AK
      </span>
      <span className="text-base">AgeKey</span>
    </span>
  );
}
