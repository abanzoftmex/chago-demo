/**
 * UI compartida entre el panel de setup multi-tenant y la página de
 * detalle de tenant: estilos base, helpers de formato y el modal de
 * confirmación para respaldos, restauración y limpieza de datos.
 */

import React, { useState } from "react";

export const cardClassName =
  "rounded-[28px] border border-white/70 bg-white/80 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl";

export const inputClassName =
  "w-full rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5";

export const buttonBaseClassName =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition duration-200 focus:outline-none focus:ring-4 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:opacity-50";

export const backupTypeLabels = {
  manual: { label: "Manual", className: "bg-slate-100 text-slate-600" },
  "pre-wipe": { label: "Pre-limpieza", className: "bg-amber-100 text-amber-700" },
  "pre-restore": { label: "Pre-restauración", className: "bg-sky-100 text-sky-700" },
};

export const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const formatDateTime = (isoString) => {
  if (!isoString) return "Sin fecha";

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
};

export const formatCreatedAt = (date) => {
  if (!date) return "Sin fecha";

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

export const getTenantInitials = (name) =>
  (name || "Tenant")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

export const Spinner = ({ light = false, size = "h-4 w-4" }) => (
  <svg
    className={`animate-spin ${size} ${light ? "text-white" : "text-slate-500"}`}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
      className="opacity-20"
    />
    <path
      d="M22 12a10 10 0 0 0-10-10"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      className="opacity-90"
    />
  </svg>
);

const backupConfirmCopy = {
  wipe: {
    title: "Limpiar datos del tenant",
    tone: "rose",
    description:
      "Se eliminarán todas las colecciones de datos del tenant (entradas, salidas, transacciones, catálogos, configuración, etc.). Los usuarios se conservan y antes del borrado se crea una copia de seguridad automática.",
    confirmLabel: "Limpiar datos",
    workingLabel: "Respaldando y limpiando",
  },
  restore: {
    title: "Restaurar respaldo",
    tone: "sky",
    description:
      "Los datos actuales del tenant se reemplazarán por los del respaldo seleccionado. Los usuarios actuales se conservan y antes de restaurar se crea una copia de seguridad del estado actual.",
    confirmLabel: "Restaurar respaldo",
    workingLabel: "Restaurando datos",
  },
  delete: {
    title: "Eliminar respaldo",
    tone: "rose",
    description:
      "El archivo del respaldo se eliminará de forma permanente de Firebase. Esta acción no afecta los datos actuales del tenant.",
    confirmLabel: "Eliminar respaldo",
    workingLabel: "Eliminando respaldo",
  },
};

export const BackupConfirmModal = ({ mode, tenant, backup, onClose, onConfirm, working }) => {
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState("");

  const copy = backupConfirmCopy[mode];
  const requiresName = mode === "wipe" || mode === "restore";
  const expectedName = (tenant?.nombreEmpresa || "").trim();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (requiresName && confirmName.trim() !== expectedName) {
      setError("El nombre no coincide con el de la empresa.");
      return;
    }

    const result = await onConfirm(confirmName.trim());
    if (result?.error) {
      setError(result.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-md">
      <div className={`${cardClassName} w-full max-w-xl p-6 sm:p-8`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
              {tenant?.nombreEmpresa || "Tenant"}
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
              {copy.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={working}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-50"
          >
            Cerrar
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-500">{copy.description}</p>

        {backup && (
          <div className="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
            <p className="font-medium text-slate-900">
              Respaldo del {formatDateTime(backup.createdAt)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {backup.totalDocs ?? "—"} documentos · {formatBytes(backup.sizeBytes)} ·{" "}
              {backupTypeLabels[backup.type]?.label || backup.type}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {requiresName && (
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Escribe el nombre de la empresa para confirmar
              </label>
              <input
                type="text"
                value={confirmName}
                onChange={(event) => setConfirmName(event.target.value)}
                className={inputClassName}
                placeholder={expectedName}
                autoFocus
              />
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-200/80 pt-6 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={working}
              className={`${buttonBaseClassName} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={working || (requiresName && confirmName.trim() !== expectedName)}
              className={`${buttonBaseClassName} ${
                copy.tone === "rose"
                  ? "bg-rose-600 text-white shadow-[0_16px_30px_rgba(190,18,60,0.25)] hover:bg-rose-500"
                  : "bg-slate-950 text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)] hover:bg-slate-800"
              }`}
            >
              {working ? (
                <>
                  <Spinner light />
                  {copy.workingLabel}
                </>
              ) : (
                copy.confirmLabel
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
