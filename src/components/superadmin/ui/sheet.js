"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn, getPortalContainer } from "../lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetTitle = DialogPrimitive.Title;

/** Panel lateral izquierdo — usado para el menú móvil del superadmin. */
const SheetContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal container={getPortalContainer()}>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#14100c]/45 backdrop-blur-[6px] data-[state=open]:animate-sa-fade" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[300px] flex-col bg-sidebar outline-none data-[state=open]:animate-sa-sheet-in",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-sidebar-muted outline-none transition hover:bg-white/10 hover:text-white focus-visible:ring-4 focus-visible:ring-white/20">
        <X className="size-4" />
        <span className="sr-only">Cerrar menú</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = "SheetContent";

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle };
