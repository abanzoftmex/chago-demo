import { cn } from "../lib/utils";

function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-16 text-center", className)}>
      {Icon && (
        <div className="flex size-14 items-center justify-center rounded-2xl border border-border/80 bg-accent/60 text-muted-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.6)]">
          <Icon className="size-6" strokeWidth={1.6} />
        </div>
      )}
      <h3 className="mt-5 font-display text-xl font-semibold tracking-[-0.02em] text-foreground">
        {title}
      </h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export { EmptyState };
