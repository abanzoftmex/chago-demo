/**
 * Superadmin · Nuevo tenant — flujo de provisión:
 * crea la empresa y su administrador principal en una sola operación.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  ListChecks,
  Plus,
  Sparkles,
} from "lucide-react";
import SuperAdminLayout from "../../../../components/superadmin/SuperAdminLayout";
import { useSuperAdmin } from "../../../../components/superadmin/SuperAdminContext";
import { createNewTenant } from "../../../../lib/helpers/migrationHelper";
import { PageHeader } from "../../../../components/superadmin/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/superadmin/ui/card";
import { Button } from "../../../../components/superadmin/ui/button";
import { Input } from "../../../../components/superadmin/ui/input";
import { Label } from "../../../../components/superadmin/ui/label";
import { Spinner } from "../../../../components/superadmin/ui/spinner";
import { ResultAlert } from "../../../../components/superadmin/ui/alert";
import { CopyId } from "../../../../components/superadmin/ui/copy-button";

const checklist = [
  "Confirma el nombre comercial exacto de la empresa.",
  "Verifica el correo del administrador principal.",
  "Define una contraseña temporal de al menos 6 caracteres.",
  "Desde el directorio podrás actualizar el correo después si hace falta.",
];

const emptyForm = { nombreEmpresa: "", ownerName: "", ownerEmail: "", ownerPassword: "" };

function NewTenantContent() {
  const router = useRouter();
  const { loadTenants } = useSuperAdmin();

  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [created, setCreated] = useState(null);

  const isComplete =
    form.nombreEmpresa.trim() &&
    form.ownerName.trim() &&
    form.ownerEmail.trim() &&
    form.ownerPassword;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setResult(null);

    if (form.ownerPassword.length < 6) {
      setResult({ tone: "error", title: "La contraseña debe tener al menos 6 caracteres." });
      return;
    }

    setLoading(true);

    try {
      const response = await createNewTenant(
        form.ownerEmail.trim(),
        form.ownerPassword,
        form.ownerName.trim(),
        form.nombreEmpresa.trim()
      );

      if (response.success) {
        setCreated({
          tenantId: response.tenantId,
          empresa: response.nombreEmpresa,
          adminEmail: response.user.email,
        });
        setForm(emptyForm);
        loadTenants();
      } else {
        setResult({ tone: "error", title: response.error });
      }
    } catch (error) {
      setResult({ tone: "error", title: `Error inesperado: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="sa-rise">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/superadmin/tenants">
            <ArrowLeft className="size-4" />
            Volver al directorio
          </Link>
        </Button>
      </div>

      <PageHeader
        className="mt-4"
        eyebrow="Provisión"
        title="Da de alta un nuevo tenant."
        description="Genera la empresa, asigna al administrador principal y deja listo el acceso inicial desde una sola operación."
      />

      {created ? (
        /* Estado de éxito */
        <Card className="sa-rise mx-auto mt-8 max-w-xl overflow-hidden text-center" style={{ animationDelay: "0.08s" }}>
          <CardContent className="px-8 pb-8 pt-10">
            <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-success/10 text-success">
              <CheckCircle2 className="size-8" strokeWidth={1.6} />
            </div>
            <h2 className="mt-6 font-display text-3xl font-semibold tracking-[-0.025em] text-foreground">
              Tenant creado
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              <span className="font-semibold text-foreground">{created.empresa}</span> quedó
              provisionado y su administrador ya puede iniciar sesión con{" "}
              <span className="font-semibold text-foreground">{created.adminEmail}</span>.
            </p>

            <div className="mt-6 flex justify-center">
              <CopyId value={created.tenantId} />
            </div>

            <div className="mt-8 flex flex-col-reverse justify-center gap-2.5 sm:flex-row">
              <Button variant="outline" onClick={() => setCreated(null)}>
                <Plus className="size-4" />
                Crear otro tenant
              </Button>
              <Button
                variant="brand"
                onClick={() => router.push(`/admin/superadmin/tenants/${created.tenantId}`)}
              >
                Ver detalle del tenant
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-8 grid items-start gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          {/* Formulario */}
          <Card className="sa-rise" style={{ animationDelay: "0.08s" }}>
            <CardHeader className="flex-row items-center gap-3.5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-brand">
                <Building2 className="size-5" strokeWidth={1.8} />
              </div>
              <div>
                <CardTitle>Datos del tenant</CardTitle>
                <CardDescription className="mt-0.5">
                  Todos los campos son obligatorios.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="sa-new-empresa">Nombre de la empresa</Label>
                  <Input
                    id="sa-new-empresa"
                    name="nombreEmpresa"
                    value={form.nombreEmpresa}
                    onChange={handleChange}
                    placeholder="Ej. Casa Valquirico"
                    autoFocus
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="sa-new-nombre">Nombre del admin</Label>
                    <Input
                      id="sa-new-nombre"
                      name="ownerName"
                      value={form.ownerName}
                      onChange={handleChange}
                      placeholder="Nombre completo"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sa-new-correo">Correo del admin</Label>
                    <Input
                      id="sa-new-correo"
                      name="ownerEmail"
                      type="email"
                      value={form.ownerEmail}
                      onChange={handleChange}
                      placeholder="admin@empresa.com"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="sa-new-password">Contraseña inicial</Label>
                  <div className="relative">
                    <Input
                      id="sa-new-password"
                      name="ownerPassword"
                      type={showPassword ? "text" : "password"}
                      value={form.ownerPassword}
                      onChange={handleChange}
                      placeholder="Mínimo 6 caracteres"
                      className="pr-11"
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
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    El administrador podrá iniciar sesión inmediatamente después de crear el
                    tenant.
                  </p>
                </div>

                {result && <ResultAlert result={result} onClose={() => setResult(null)} />}

                <div className="flex justify-end border-t border-border/60 pt-5">
                  <Button type="submit" variant="brand" size="lg" disabled={loading || !isComplete}>
                    {loading ? (
                      <>
                        <Spinner />
                        Creando tenant
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4" />
                        Crear tenant
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Checklist lateral */}
          <Card className="sa-rise bg-card/70" style={{ animationDelay: "0.16s" }}>
            <CardHeader className="flex-row items-center gap-3.5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-brand">
                <ListChecks className="size-5" strokeWidth={1.8} />
              </div>
              <div>
                <CardTitle>Antes de provisionar</CardTitle>
                <CardDescription className="mt-0.5">Una revisión rápida.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3.5">
                {checklist.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-success" strokeWidth={1.8} />
                    <p className="text-sm leading-6 text-muted-foreground">{item}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

export default function NewTenantPage() {
  return (
    <SuperAdminLayout title="Nuevo tenant">
      <NewTenantContent />
    </SuperAdminLayout>
  );
}
