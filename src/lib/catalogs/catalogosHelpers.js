/**
 * Utilidades compartidas para exportación/importación de catálogos (Gestión de catálogos).
 */

/** Una línea CSV con comillas escapadas → celdas recortadas */
export function splitCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  let j = 0;
  while (j < line.length) {
    const char = line[j];
    const nextChar = line[j + 1];
    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      j += 2;
    } else if (char === '"') {
      inQuotes = !inQuotes;
      j++;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      j++;
    } else {
      current += char;
      j++;
    }
  }
  values.push(current.trim());
  return values;
}

export function normalizeCsvHeader(s) {
  return String(s || "")
    .replace(/^\ufeff/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** entrada | salida | ambos; acepta sinónimos ingreso/gasto */
export function normalizeTipoMovimiento(raw) {
  const tipo = String(raw || "")
    .trim()
    .toLowerCase();
  if (["entrada", "salida", "ambos"].includes(tipo)) return tipo;
  const map = { ingreso: "entrada", gasto: "salida", "ingreso/gasto": "ambos" };
  if (map[tipo]) return map[tipo];
  return "ambos";
}

export function parseSiNoCell(val, defaultVal = true) {
  if (val === undefined || val === null || val === "") return defaultVal;
  if (typeof val === "boolean") return val;
  const s = String(val).trim().toLowerCase();
  if (["no", "false", "0", "n"].includes(s)) return false;
  if (["sí", "si", "yes", "true", "1", "s"].includes(s)) return true;
  return defaultVal;
}

export function formatGeneralCreatedAtForExport(item) {
  const ts = item?.createdAt;
  if (!ts) return "";
  try {
    if (ts.toDate && typeof ts.toDate === "function") return ts.toDate().toISOString();
    if (typeof ts.seconds === "number")
      return new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1e6).toISOString();
  } catch (_) {
    /* ignore */
  }
  return "";
}

export function detectGeneralesCsvLayout(headerCells) {
  const h = headerCells.map(normalizeCsvHeader);
  const legacy =
    h.length >= 3 &&
    h[1].includes("descripcion") &&
    h[2].includes("tipo") &&
    h[2].includes("movimiento");
  return legacy ? "legacy" : "v2";
}

export function parseGeneralesDataRow(values, layout) {
  if (layout === "legacy") {
    if (values.length < 3) {
      throw new Error(
        `Formato anterior: se esperaban al menos Nombre, Descripción y Tipo Movimiento; hay ${values.length} columnas`
      );
    }
    return {
      name: values[0]?.trim(),
      description: values[1]?.trim() || "",
      type: normalizeTipoMovimiento(values[2]),
      hasPreviousBalance: false,
      isActive: values.length > 3 ? parseSiNoCell(values[3], true) : true,
    };
  }
  if (values.length < 3) {
    throw new Error(
      `Se esperaban al menos Nombre, Tipo y Descripción; hay ${values.length} columnas`
    );
  }
  const name = values[0]?.trim();
  const type = normalizeTipoMovimiento(values[1]);
  const description = values[2]?.trim() || "";
  if (values.length === 3) {
    return { name, type, description, hasPreviousBalance: false, isActive: true };
  }
  if (values.length === 4) {
    return {
      name,
      type,
      description,
      hasPreviousBalance: false,
      isActive: parseSiNoCell(values[3], true),
    };
  }
  return {
    name,
    type,
    description,
    hasPreviousBalance: parseSiNoCell(values[3], false),
    isActive: parseSiNoCell(values[4], true),
  };
}

/** Mapa nombre exacto → documento (último gana si hay duplicados de nombre) */
export function catalogByNameMap(items) {
  const m = new Map();
  if (!Array.isArray(items)) return m;
  for (const item of items) {
    if (item?.name != null && item.name !== "") m.set(item.name, item);
  }
  return m;
}

export function rowsToCsvString(rows) {
  return rows
    .map((row) =>
      row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
}

export function triggerDownloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
