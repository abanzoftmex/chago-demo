import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "../lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium outline-none transition-all duration-200 focus-visible:ring-4 focus-visible:ring-ring/25 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(27,23,18,0.25),0_12px_28px_-10px_rgba(27,23,18,0.45)] hover:bg-[#2e2820]",
        brand:
          "bg-brand text-brand-foreground shadow-[0_1px_2px_rgba(178,90,40,0.35),0_12px_28px_-10px_rgba(178,90,40,0.55)] hover:bg-[#a04f22]",
        outline:
          "border border-border bg-card text-foreground shadow-[0_1px_2px_rgba(27,23,18,0.05)] hover:border-[#d6cdbd] hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-[#e4ddd0]",
        ghost: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_1px_2px_rgba(180,35,50,0.35),0_12px_28px_-10px_rgba(180,35,50,0.5)] hover:bg-[#9d1e2c]",
        "destructive-outline":
          "border border-destructive/25 bg-card text-destructive shadow-[0_1px_2px_rgba(27,23,18,0.04)] hover:border-destructive/40 hover:bg-destructive/5",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 gap-1.5 rounded-lg px-3 text-[13px]",
        lg: "h-12 rounded-2xl px-6 text-[15px]",
        icon: "size-10",
        "icon-sm": "size-8 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
