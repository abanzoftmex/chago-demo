/**
 * Superadmin · Tenants — directorio completo con búsqueda,
 * edición rápida y acciones por tenant.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Building2,
  DatabaseBackup,
  Eye,
  MoreHorizontal,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  Trash2,
} from "lucide-react";
import SuperAdminLayout from "../../../../components/superadmin/SuperAdminLayout";
import { useSuperAdmin } from "../../../../components/superadmin/SuperAdminContext";
import { useBackups } from "../../../../components/superadmin/hooks/useBackups";
import { TenantEditDialog } from "../../../../components/superadmin/TenantEditDialog";
import { BackupConfirmDialog } from "../../../../components/superadmin/BackupConfirmDialog";
import { PageHeader } from "../../../../components/superadmin/ui/page-header";
import { Card } from "../../../../components/superadmin/ui/card";
import { Button } from "../../../../components/superadmin/ui/button";
import { Badge } from "../../../../components/superadmin/ui/badge";
import { Input } from "../../../../components/superadmin/ui/input";
import { Skeleton } from "../../../../components/superadmin/ui/skeleton";
import { EmptyState } from "../../../../components/superadmin/ui/empty-state";
import { ResultAlert } from "../../../../components/superadmin/ui/alert";
import { CopyId } from "../../../../components/superadmin/ui/copy-button";
import { TenantAvatar } from "../../../../components/superadmin/ui/tenant-avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/superadmin/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../../components/superadmin/ui/dropdown-menu";
import { formatDate, formatRelative } from "../../../../components/superadmin/lib/format";

function TenantActionsMenu({ tenant, onEdit, onWipe }) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Acciones de ${tenant.nombreEmpresa}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => router.push(`/admin/superadmin/tenants/${tenant.id}`)}>
          <Eye />
          Ver detalle
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onEdit(tenant)}>
          <PencilLine />
          Editar datos
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => router.push(`/admin/superadmin/respaldos?tenant=${tenant.id}`)}
        >
          <DatabaseBackup />
          Ir a respaldos
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => onWipe(tenant)}>
          <Trash2 />
          Limpiar datos
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TenantsDirectoryContent() {
  const { tenants, tenantsLoading, loadTenants, sessionExpired } = useSuperAdmin();

  const [search, setSearch] = useState("");
  const [result, setResult] = useState(null);
  const [editingTenant, setEditingTenant] = useState(null);
  const [savingTenant, setSavingTenant] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const { working, runConfirmedAction } = useBackups({ setResult });

  const filteredTenants = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tenants;

    return tenants.filter((tenant) =>
      [tenant.nombreEmpresa, tenant.adminName, tenant.adminEmail, tenant.id]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [tenants, search]);

  const handleTenantUpdate = async (payload) => {
    setSavingTenant(true);

    try {
      const response = await fetch("/api/admin/update-tenant-setup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          sessionExpired();
          return { error: data.message || "La sesión de configuración expiró." };
        }
        return { error: data.message || "No se pudo actualizar el tenant." };
      }

      setEditingTenant(null);
      setResult({
        tone: "success",
        title: "Tenant actualizado correctamente.",
        lines: [`Empresa: ${payload.nombreEmpresa}`, `Admin: ${payload.adminEmail}`],
      });
      await loadTenants();
      return { success: true };
    } catch {
      return { error: "Error de conexión al actualizar el tenant." };
    } finally {
      setSavingTenant(false);
    }
  };

  const handleConfirm = (confirmName) =>
    runConfirmedAction(confirmAction, confirmName, {
      onDone: async () => {
        setConfirmAction(null);
        await loadTenants();
      },
    });

  return (
    <>
      <PageHeader
        eyebrow="Directorio"
        title="Todos tus tenants, en orden."
        description="Busca, abre el detalle, actualiza datos del admin o gestiona la información de cada empresa."
        actions={
          <>
            <Button variant="outline" onClick={loadTenants} disabled={tenantsLoading}>
              <RefreshCw className={tenantsLoading ? "size-4 animate-spin" : "size-4"} />
              Actualizar
            </Button>
            <Button asChild variant="brand">
              <Link href="/admin/superadmin/tenants/nuevo">
                <Plus className="size-4" />
                Nuevo tenant
              </Link>
            </Button>
          </>
        }
      />

      {result && <ResultAlert result={result} onClose={() => setResult(null)} className="mt-6" />}

      {/* Búsqueda + conteo */}
      <div className="sa-rise mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ animationDelay: "0.1s" }}>
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por empresa, admin, correo o ID…"
            className="pl-10"
          />
        </div>
        <Badge variant="outline" className="h-7 px-3 text-[13px]">
          {tenantsLoading && tenants.length === 0
            ? "Cargando directorio…"
            : `${filteredTenants.length} de ${tenants.length} tenant${tenants.length === 1 ? "" : "s"}`}
        </Badge>
      </div>

      <Card className="sa-rise mt-4 overflow-hidden" style={{ animationDelay: "0.16s" }}>
        {tenantsLoading && tenants.length === 0 ? (
          <div className="space-y-4 p-6">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="size-11 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-3 w-2/5" />
                </div>
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            ))}
          </div>
        ) : tenants.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Aún no hay tenants registrados"
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
        ) : filteredTenants.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Sin resultados"
            description={`Ningún tenant coincide con “${search.trim()}”. Prueba con otro término.`}
            action={
              <Button variant="outline" onClick={() => setSearch("")}>
                Limpiar búsqueda
              </Button>
            }
          />
        ) : (
          <>
            {/* Tabla (md+) */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Empresa</TableHead>
                    <TableHead>Administrador</TableHead>
                    <TableHead>Alta</TableHead>
                    <TableHead>Tenant ID</TableHead>
                    <TableHead className="w-12 text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell>
                        <Link
                          href={`/admin/superadmin/tenants/${tenant.id}`}
                          className="group flex items-center gap-3.5 outline-none"
                        >
                          <TenantAvatar name={tenant.nombreEmpresa} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-foreground transition-colors group-hover:text-brand">
                              {tenant.nombreEmpresa}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {formatRelative(tenant.createdAt) || "Sin fecha"}
                            </span>
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        {tenant.adminName !== tenant.adminEmail && (
                          <p className="text-sm text-foreground">{tenant.adminName}</p>
                        )}
                        <p
                          className={
                            tenant.adminName !== tenant.adminEmail
                              ? "text-xs text-muted-foreground"
                              : "text-sm text-foreground"
                          }
                        >
                          {tenant.adminEmail}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(tenant.createdAt)}
                      </TableCell>
                      <TableCell>
                        <CopyId value={tenant.id} className="max-w-[200px]" />
                      </TableCell>
                      <TableCell className="text-right">
                        <TenantActionsMenu
                          tenant={tenant}
                          onEdit={setEditingTenant}
                          onWipe={(t) => setConfirmAction({ mode: "wipe", tenant: t })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Lista (móvil) */}
            <div className="divide-y divide-border/60 md:hidden">
              {filteredTenants.map((tenant) => (
                <div key={tenant.id} className="flex items-start gap-3.5 px-5 py-4">
                  <TenantAvatar name={tenant.nombreEmpresa} size="sm" className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/superadmin/tenants/${tenant.id}`}
                      className="text-sm font-semibold text-foreground"
                    >
                      {tenant.nombreEmpresa}
                    </Link>
                    <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                      {tenant.adminEmail}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{formatDate(tenant.createdAt)}</Badge>
                      <CopyId value={tenant.id} className="max-w-[180px]" />
                    </div>
                  </div>
                  <TenantActionsMenu
                    tenant={tenant}
                    onEdit={setEditingTenant}
                    onWipe={(t) => setConfirmAction({ mode: "wipe", tenant: t })}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <TenantEditDialog
        tenant={editingTenant}
        onClose={() => setEditingTenant(null)}
        onSave={handleTenantUpdate}
        saving={savingTenant}
      />

      <BackupConfirmDialog
        action={confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        working={working}
      />
    </>
  );
}

export default function TenantsDirectoryPage() {
  return (
    <SuperAdminLayout title="Tenants">
      <TenantsDirectoryContent />
    </SuperAdminLayout>
  );
}
