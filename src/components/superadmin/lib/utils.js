import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Contenedor para portales de Radix (Dialog, DropdownMenu, Select).
 * El layout del superadmin monta un div#sa-portal con la clase de tema y las
 * variables de fuente; sin él, los portales caerían en <body> fuera del scope
 * `.superadmin` y perderían tokens y tipografía.
 */
export function getPortalContainer() {
  if (typeof document === "undefined") return undefined;
  return document.getElementById("sa-portal") || undefined;
}
