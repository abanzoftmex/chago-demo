import { cn } from "../lib/utils";

/**
 * Encabezado estándar de página del superadmin:
 * eyebrow (kicker en mayúsculas) + título display + descripción + acciones.
 */
function PageHeader({ eyebrow, title, description, actions, className, children }) {
  return (
    <header className={cn("sa-rise", className)}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          {eyebrow && (
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand">
              <span className="inline-block h-px w-6 bg-brand/60" />
              {eyebrow}
            </p>
          )}
          <h1 className="mt-3 font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.025em] text-foreground sm:text-[2.5rem]">
            {title}
          </h1>
          {description && (
            <p className="mt-3 text-[15px] leading-7 text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export { PageHeader };
