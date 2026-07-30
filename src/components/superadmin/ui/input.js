import * as React from "react";
import { cn } from "../lib/utils";

const Input = React.forwardRef(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "h-10 w-full rounded-xl border border-input/70 bg-card px-3.5 text-sm text-foreground shadow-[inset_0_1px_2px_rgba(27,23,18,0.04)] outline-none transition duration-200 placeholder:text-muted-foreground/70 focus:border-ring/60 focus:ring-4 focus:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
