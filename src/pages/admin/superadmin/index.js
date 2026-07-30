/**
 * Superadmin · Resumen — vista general del sistema multi-tenant:
 * métricas, altas recientes y accesos directos a cada área.
 */

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarClock,
  DatabaseBackup,
  MailCheck,
  Plus,
  Sparkles,
} from "lucide-react";
import SuperAdminLayout from "../../../components/superadmin/SuperAdminLayout";
import { useSuperAdmin } from "../../../components/superadmin/SuperAdminContext";
import { PageHeader } from "../../../components/superadmin/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/superadmin/ui/card";
import { Button } from "../../../components/superadmin/ui/button";
import { Badge } from "../../../components/superadmin/ui/badge";
import { Skeleton } from "../../../components/superadmin/ui/skeleton";
import { EmptyState } from "../../../components/superadmin/ui/empty-state";
import { TenantAvatar } from "../../../components/superadmin/ui/tenant-avatar";
import { formatDate, formatRelative } from "../../../components/superadmin/lib/format";

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent text-brand">
          <Icon className="size-4" strokeWidth={1.8} />
        </div>
      </div>
      <p className="mt-3 font-display text-[2.6rem] font-semibold leading-none tracking-[-0.03em] text-foreground">
        {value}
      </p>
      {hint && <p className="mt-2.5 text-[13px] leading-5 text-muted-foreground">{hint}</p>}
    </Card>
  );
}

const quickLinks = [
  {
    href: "/admin/superadmin/tenants/nuevo",
    icon: Plus,
    title: "Provisionar tenant",
    description: "Alta de empresa y administrador principal en un solo flujo.",
  },
  {
    href: "/admin/superadmin/tenants",
    icon: Building2,
    title: "Explorar el directorio",
    description: "Consulta, edita y abre el detalle de cada tenant.",
  },
  {
    href: "/admin/superadmin/respaldos",
    icon: DatabaseBackup,
    title: "Gestionar respaldos",
    description: "Copias de seguridad, restauración y limpieza de datos.",
  },
];

function HomeContent() {
  const { tenants, tenantsLoading, metrics } = useSuperAdmin();
  const recentTenants = tenants.slice(0, 5);

  return (
    <>
      <PageHeader
        eyebrow="Resumen"
        title="El estado de tu plataforma, de un vistazo."
        description="Monitorea las altas, el directorio y la salud operativa del sistema multi-tenant."
        actions={
          <Button asChild variant="brand">
            <Link href="/admin/superadmin/tenants/nuevo">
              <Plus className="size-4" />
              Nuevo tenant
            </Link>
          </Button>
        }
      />

      {/* Métricas */}
      <div className="sa-stagger mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Building2}
          label="Tenants activos"
          value={tenantsLoading ? "…" : metrics.total}
          hint="Empresas disponibles en la instancia"
        />
        <StatCard
          icon={Sparkles}
          label="Altas recientes"
          value={tenantsLoading ? "…" : metrics.recent}
          hint="Creados en los últimos 30 días"
        />
        <StatCard
          icon={MailCheck}
          label="Admins con correo"
          value={tenantsLoading ? "…" : metrics.owners}
          hint="Registros listos para acceso"
        />
        <StatCard
          icon={CalendarClock}
          label="Última alta"
          value={
            tenantsLoading ? "…" : metrics.lastCreatedAt ? formatDate(metrics.lastCreatedAt) : "—"
          }
          hint={
            metrics.lastCreatedAt ? formatRelative(metrics.lastCreatedAt) : "Aún sin registros"
          }
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        {/* Altas recientes */}
        <Card className="sa-rise overflow-hidden" style={{ animationDelay: "0.18s" }}>
          <CardHeader className="flex-row items-end justify-between pb-4">
            <div>
              <CardTitle>Altas recientes</CardTitle>
              <CardDescription className="mt-1">
                Los últimos tenants provisionados en la plataforma.
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="shrink-0">
              <Link href="/admin/superadmin/tenants">
                Ver todos
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>

          {tenantsLoading ? (
            <CardContent className="space-y-3 pt-0">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3.5">
                  <Skeleton className="size-11 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </CardContent>
          ) : recentTenants.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Aún no hay tenants"
              description="Crea el primero desde el flujo de provisión para comenzar a operar."
              action={
                <Button asChild variant="brand">
                  <Link href="/admin/superadmin/tenants/nuevo">
                    <Plus className="size-4" />
                    Crear tenant
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-border/60 border-t border-border/60">
              {recentTenants.map((tenant) => (
                <Link
                  key={tenant.id}
                  href={`/admin/superadmin/tenants/${tenant.id}`}
                  className="group flex items-center gap-4 px-6 py-4 outline-none transition-colors hover:bg-accent/50 focus-visible:bg-accent/50"
                >
                  <TenantAvatar name={tenant.nombreEmpresa} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {tenant.nombreEmpresa}
                    </p>
                    <p className="truncate text-[13px] text-muted-foreground">
                      {tenant.adminEmail}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge variant="outline">{formatDate(tenant.createdAt)}</Badge>
                    <ArrowUpRight className="size-4 text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Accesos directos */}
        <div className="sa-rise space-y-4" style={{ animationDelay: "0.24s" }}>
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-center gap-4 rounded-3xl border border-border/80 bg-card p-5 shadow-[0_1px_2px_rgba(27,23,18,0.04),0_18px_44px_-24px_rgba(27,23,18,0.18)] outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d6cdbd] hover:shadow-[0_2px_4px_rgba(27,23,18,0.05),0_24px_52px_-24px_rgba(27,23,18,0.28)] focus-visible:ring-4 focus-visible:ring-ring/25"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-brand transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
                <link.icon className="size-5" strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{link.title}</p>
                <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">
                  {link.description}
                </p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:text-brand" />
            </Link>
          ))}

          <div className="rounded-3xl border border-dashed border-border bg-accent/40 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Documentación
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Consulta{" "}
              <span className="font-semibold text-foreground">MULTI_TENANT_GUIDE.md</span> para la
              guía completa de configuración y operación del sistema.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function SuperAdminHomePage() {
  return (
    <SuperAdminLayout title="Resumen">
      <HomeContent />
    </SuperAdminLayout>
  );
}
