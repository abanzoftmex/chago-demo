"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "../lib/utils";

/** Chip monoespaciado con el ID + botón de copiado con feedback. */
function CopyId({ value, className }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (event) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard no disponible: no interrumpir */
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copiar ID"
      className={cn(
        "group/copy inline-flex max-w-full cursor-pointer items-center gap-2 rounded-lg border border-border/80 bg-accent/50 py-1 pl-2.5 pr-2 font-mono text-xs text-muted-foreground outline-none transition hover:border-[#d6cdbd] hover:bg-accent hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/25",
        className
      )}
    >
      <span className="truncate">{value}</span>
      {copied ? (
        <Check className="size-3.5 shrink-0 text-success" />
      ) : (
        <Copy className="size-3.5 shrink-0 opacity-50 transition group-hover/copy:opacity-100" />
      )}
    </button>
  );
}

export { CopyId };
