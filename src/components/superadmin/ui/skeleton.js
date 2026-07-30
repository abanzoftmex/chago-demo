import { cn } from "../lib/utils";

function Skeleton({ className, ...props }) {
  return <div className={cn("animate-pulse rounded-xl bg-foreground/[0.07]", className)} {...props} />;
}

export { Skeleton };
