import { cn } from '@/lib/utils';

/** Animated "…" chat bubble. size="sm" sits on a footer avatar; "md" sits above the debate input. */
export function TypingBubble({ size = 'md', className, label, ...rest }: { size?: 'sm' | 'md'; className?: string; label?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  const dot = size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5';
  return (
    <span
      role="status"
      aria-label={label ?? 'Typing'}
      className={cn(
        'inline-flex items-center gap-[3px] rounded-full bg-primary text-primary-foreground shadow ring-2 ring-background',
        size === 'sm' ? 'px-1.5 py-1' : 'px-2.5 py-1.5',
        className,
      )}
      {...rest}
    >
      {[0, 150, 300].map((d) => (
        <span key={d} className={cn(dot, 'rounded-full bg-current animate-bounce')} style={{ animationDelay: `${d}ms`, animationDuration: '1s' }} />
      ))}
    </span>
  );
}
