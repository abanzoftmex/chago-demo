/**
 * Superadmin · Acceso compartido de un negocio.
 *
 * Una persona —un directivo que lleva varios negocios— entra a este con su misma
 * cuenta y salta de uno a otro desde el menú de usuario. Solo se da y se quita
 * desde aquí: el administrador del negocio la ve en Usuarios pero no la puede
 * editar ni borrar (ver `lib/server/accesoCompartido.js`).
 *
 * No hace falta crearle un negocio propio al directivo: «Crear tenant» daría un
 * negocio vacío que aparecería en su lista.
 */

import { useCallback, useEffect, useState } from "react";
import { Share2, UserMinus, UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Skeleton } from "./ui/skeleton";
import { formatDateTime } from "./lib/format";

const ROLES = [
  { valor: "admin", etiqueta: "Administrador" },
  { valor: "contador", etiqueta: "Contador" },
  { valor: "viewer", etiqueta: "Visor (solo consulta)" },
];
const etiquetaDeRol = (rol) => ROLES.find((r) => r.valor === rol)?.etiqueta.split(" (")[0] || rol;

const VACIO = { email: "", displayName: "", password: "", role: "admin" };

export function AccesoCompartidoCard({ tenantId, onResult, onSessionExpired, style }) {
  const [accesos, setAccesos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [form, setForm] = useState(VACIO);
  const [aQuitar, setAQuitar] = useState(null); // { acceso, requiereBaja }

  const llamar = useCallback(
    async (method, body) => {
      const url =
        method === "GET"
          ? `/api/admin/shared-access?tenantId=${encodeURIComponent(tenantId)}`
          : "/api/admin/shared-access";
      const respuesta = await fetch(
        url,
        method === "GET"
          ? undefined
          : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, ...body }) }
      );
      const data = await respuesta.json().catch(() => ({}));
      if (respuesta.status === 401) onSessionExpired?.();
      return { ok: respuesta.ok, data };
    },
    [tenantId, onSessionExpired]
  );

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { ok, data } = await llamar("GET");
      if (ok) setAccesos(data.accesos || []);
      else onResult?.({ tone: "error", title: data?.message || "No se pudieron cargar los accesos compartidos." });
    } catch (error) {
      onResult?.({ tone: "error", title: `Error cargando los accesos compartidos: ${error.message}` });
    } finally {
      setCargando(false);
    }
  }, [llamar, onResult]);

  useEffect(() => {
    if (tenantId) cargar();
  }, [tenantId, cargar]);

  const darAcceso = async (evento) => {
    evento.preventDefault();
    setTrabajando(true);
    try {
      const { ok, data } = await llamar("POST", {
        email: form.email,
        displayName: form.displayName || undefined,
        password: form.password || undefined,
        role: form.role,
      });
      if (!ok) {
        onResult?.({ tone: "error", title: data?.message || "No se pudo dar el acceso." });
        return;
      }
      onResult?.({
        tone: "success",
        title: data.cuentaNueva ? "Acceso dado y cuenta creada." : "Acceso dado.",
        lines: [
          data.otrosNegocios > 0
            ? `Con la misma cuenta ya entra a ${data.otrosNegocios} negocio${data.otrosNegocios === 1 ? "" : "s"} más.`
            : "Es su primer negocio.",
        ],
      });
      setForm(VACIO);
      await cargar();
    } catch (error) {
      onResult?.({ tone: "error", title: `Error: ${error.message}` });
    } finally {
      setTrabajando(false);
    }
  };

  const quitarAcceso = async (eliminarCuenta = false) => {
    if (!aQuitar) return;
    setTrabajando(true);
    try {
      const { ok, data } = await llamar("DELETE", { userId: aQuitar.acceso.userId, eliminarCuenta });
      if (!ok && data?.requiereBaja) {
        // Era su último negocio: no se deja una cuenta sin ninguno, hay que darla de baja.
        setAQuitar({ ...aQuitar, requiereBaja: true });
        return;
      }
      if (!ok) {
        onResult?.({ tone: "error", title: data?.message || "No se pudo quitar el acceso." });
        return;
      }
      onResult?.({
        tone: "success",
        title: data.cuentaEliminada ? "Acceso quitado y cuenta dada de baja." : "Acceso quitado.",
      });
      setAQuitar(null);
      await cargar();
    } catch (error) {
      onResult?.({ tone: "error", title: `Error: ${error.message}` });
    } finally {
      setTrabajando(false);
    }
  };

  const campo = "h-10 w-full rounded-xl border border-input/70 bg-card px-3.5 text-sm text-foreground outline-none focus:border-ring/60 focus:ring-4 focus:ring-ring/15";

  return (
    <Card className="sa-rise overflow-hidden" style={style}>
      <CardHeader className="flex-row items-start justify-between gap-3 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="size-4 text-muted-foreground" strokeWidth={1.8} />
            Acceso compartido
          </CardTitle>
          <CardDescription className="mt-1">
            Personas que entran a este negocio con su misma cuenta y pueden saltar entre varios
            negocios después de iniciar sesión.
          </CardDescription>
        </div>
        {!cargando && <Badge variant="secondary">{accesos?.length || 0}</Badge>}
      </CardHeader>

      <CardContent className="space-y-5 pt-0">
        {cargando ? (
          <Skeleton className="h-16 rounded-2xl" />
        ) : accesos?.length ? (
          <ul className="divide-y divide-border/60 rounded-2xl border border-border/70">
            {accesos.map((acceso) => (
              <li key={acceso.userId} className="space-y-2 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {acceso.displayName || acceso.email}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{acceso.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {etiquetaDeRol(acceso.role)}
                      {acceso.otrosNegocios > 0
                        ? ` · entra también a ${acceso.otrosNegocios} negocio${acceso.otrosNegocios === 1 ? "" : "s"} más`
                        : " · solo a este negocio"}
                      {acceso.vinculadoAt ? ` · desde ${formatDateTime(acceso.vinculadoAt)}` : ""}
                    </p>
                  </div>
                  {aQuitar?.acceso.userId !== acceso.userId && (
                    <Button
                      variant="destructive-outline"
                      size="sm"
                      onClick={() => setAQuitar({ acceso, requiereBaja: false })}
                      disabled={trabajando}
                    >
                      <UserMinus className="size-3.5" />
                      Quitar acceso
                    </Button>
                  )}
                </div>

                {aQuitar?.acceso.userId === acceso.userId && (
                  <div className="space-y-2 rounded-xl border border-destructive/25 bg-destructive/5 p-3">
                    <p className="text-sm text-foreground">
                      {aQuitar.requiereBaja
                        ? "Es el último negocio de esta persona. Una cuenta no puede quedarse sin ninguno: hay que darla de baja, y se borra también su cuenta."
                        : "Se quita solo el acceso a este negocio; su cuenta y sus otros negocios no se tocan."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => quitarAcceso(aQuitar.requiereBaja)}
                        disabled={trabajando}
                      >
                        {aQuitar.requiereBaja ? "Dar de baja la cuenta" : "Sí, quitar acceso"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setAQuitar(null)} disabled={trabajando}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nadie tiene acceso compartido a este negocio.</p>
        )}

        <form onSubmit={darAcceso} className="space-y-3 rounded-2xl border border-border/70 p-4">
          <p className="text-sm font-semibold text-foreground">Dar acceso</p>

          <div className="space-y-1.5">
            <Label htmlFor="ac-email">Correo de la persona</Label>
            <Input
              id="ac-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="directivo@empresa.com"
              autoComplete="off"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ac-rol">Rol en este negocio</Label>
            <select
              id="ac-rol"
              className={campo}
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              {ROLES.map((r) => (
                <option key={r.valor} value={r.valor}>
                  {r.etiqueta}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ac-nombre">Nombre (si la cuenta es nueva)</Label>
              <Input
                id="ac-nombre"
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ac-clave">Contraseña (si la cuenta es nueva)</Label>
              <Input
                id="ac-clave"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                autoComplete="new-password"
              />
            </div>
          </div>

          <p className="text-xs leading-5 text-muted-foreground">
            Si el correo ya tiene cuenta se usa esa misma y no hace falta contraseña. Restablecer
            la contraseña de esta persona la cambia en <strong>todos</strong> sus negocios. No uses
            «Crear tenant» para un directivo: eso crea un negocio vacío que aparecería en su lista.
          </p>

          <Button type="submit" disabled={trabajando || !form.email.trim()}>
            <UserPlus className="size-4" />
            Dar acceso
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
