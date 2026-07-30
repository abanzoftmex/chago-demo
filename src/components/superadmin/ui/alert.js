import * as React from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";
import { cn } from "../lib/utils";

/**
 * Banner de resultado de operación. `result` tiene la forma:
 * { tone: "success" | "error", title: string, lines?: string[] }
 */
function ResultAlert({ result, onClose, className }) {
  if (!result) return null;
  const success = result.tone === "success";
  const Icon = success ? CheckCircle2 : AlertTriangle;

  return (
    <div
      role="status"
      className={cn(
        "sa-rise flex items-start gap-3.5 rounded-2xl border p-4 pr-3 shadow-[0_1px_2px_rgba(27,23,18,0.04),0_14px_34px_-20px_rgba(27,23,18,0.2)]",
        success
          ? "border-success/25 bg-[#f0f7f1] text-[#14532d]"
          : "border-destructive/25 bg-[#fdf1f2] text-[#7f1d1d]",
        className
      )}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", success ? "text-success" : "text-destructive")} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{result.title}</p>
        {result.lines?.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-sm leading-6 opacity-85">
            {result.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg opacity-60 outline-none transition hover:bg-black/5 hover:opacity-100 focus-visible:ring-4 focus-visible:ring-ring/25"
        >
          <X className="size-4" />
          <span className="sr-only">Cerrar aviso</span>
        </button>
      )}
    </div>
  );
}

export { ResultAlert };
