"use client";

import { useState } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound, ShieldCheck, Timer } from "lucide-react";
import { useSuperAdmin } from "./SuperAdminContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Spinner } from "./ui/spinner";

const highlights = [
  {
    icon: ShieldCheck,
    title: "Acceso maestro",
    description: "Protegido con la clave de entorno del sistema.",
  },
  {
    icon: Timer,
    title: "Sesión temporal",
    description: "Cookie segura con vigencia de 10 minutos.",
  },
  {
    icon: KeyRound,
    title: "Control total",
    description: "Tenants, usuarios y respaldos en un solo lugar.",
  },
];

/** Pantalla de bloqueo del superadmin: pide la contraseña maestra. */
export function AccessGate() {
  const { verifyPassword } = useSuperAdmin();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await verifyPassword(password);
      if (result.error) setError(result.error);
    } catch {
      setError("Error al verificar la contraseña. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sa-grain relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Atmósfera: halos cálidos muy sutiles */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(560px_360px_at_18%_8%,rgba(178,90,40,0.09),transparent_60%),radial-gradient(520px_340px_at_85%_90%,rgba(31,122,77,0.06),transparent_60%)]" />

      <div className="sa-stagger relative w-full max-w-[420px]">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-[linear-gradient(140deg,#2b241c_0%,#17130f_60%)] text-[#e8ddcd] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_18px_38px_-14px_rgba(27,23,18,0.6)]">
            <ShieldCheck className="size-6" strokeWidth={1.7} />
          </div>
          <p className="mt-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand">
            <span className="inline-block h-px w-6 bg-brand/60" />
            Superadmin
            <span className="inline-block h-px w-6 bg-brand/60" />
          </p>
          <h1 className="mt-3 font-display text-[2.1rem] font-semibold leading-tight tracking-[-0.025em] text-foreground">
            Torre de control
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            Ingresa la clave maestra para administrar tenants, respaldos y aprovisionamiento.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-3xl border border-border/80 bg-card p-6 shadow-[0_1px_2px_rgba(27,23,18,0.04),0_24px_60px_-28px_rgba(27,23,18,0.3)] sm:p-7"
        >
          <Label htmlFor="sa-password">Contraseña de acceso</Label>
          <div className="relative">
            <Input
              id="sa-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Clave maestra"
              className="pr-11"
              autoFocus
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-1.5 top-1/2 inline-flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted-foreground outline-none transition hover:bg-accent hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/25"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          {error && (
            <p className="mt-3 rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading || !password} className="mt-5 w-full" size="lg">
            {loading ? (
              <>
                <Spinner />
                Verificando acceso
              </>
            ) : (
              <>
                Entrar al panel
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>

        <div className="mt-8 grid gap-2.5">
          {highlights.map((item) => (
            <div
              key={item.title}
              className="flex items-center gap-3.5 rounded-2xl border border-border/60 bg-card/60 px-4 py-3 backdrop-blur-sm"
            >
              <item.icon className="size-4.5 shrink-0 text-brand" strokeWidth={1.8} />
              <div className="flex min-w-0 items-baseline gap-2">
                <p className="text-[13px] font-semibold text-foreground">{item.title}</p>
                <p className="truncate text-[13px] text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
