"use client";

import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Fraunces, Schibsted_Grotesk } from "next/font/google";
import {
  Building2,
  DatabaseBackup,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContextMultiTenant";
import { SuperAdminProvider, useSuperAdmin } from "./SuperAdminContext";
import { AccessGate } from "./AccessGate";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "./ui/sheet";
import { Skeleton } from "./ui/skeleton";
import { cn } from "./lib/utils";

const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-sa-display",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const sansFont = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-sa-sans",
  weight: ["400", "500", "600", "700"],
});

const fontVariables = `${displayFont.variable} ${sansFont.variable}`;

const navItems = [
  {
    href: "/admin/superadmin",
    label: "Resumen",
    caption: "Estado general",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/admin/superadmin/tenants",
    label: "Tenants",
    caption: "Directorio y detalle",
    icon: Building2,
  },
  {
    href: "/admin/superadmin/respaldos",
    label: "Respaldos",
    caption: "Copias y restauración",
    icon: DatabaseBackup,
  },
];

function NavLink({ item, onNavigate }) {
  const router = useRouter();
  const isActive = item.exact
    ? router.pathname === item.href
    : router.pathname === item.href || router.pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 outline-none transition-all duration-200 focus-visible:ring-4 focus-visible:ring-white/15",
        isActive ? "bg-sidebar-active text-white" : "text-sidebar-muted hover:bg-white/[0.05] hover:text-sidebar-foreground"
      )}
    >
      {/* Marcador cobre del ítem activo */}
      <span
        className={cn(
          "absolute -left-3 h-5 w-[3px] rounded-full bg-brand transition-all duration-200",
          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-40"
        )}
      />
      <item.icon
        className={cn("size-[18px] shrink-0 transition-colors", isActive ? "text-brand" : "")}
        strokeWidth={1.8}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-5">{item.label}</span>
        <span
          className={cn(
            "block text-[11px] leading-4 transition-colors",
            isActive ? "text-sidebar-muted" : "text-sidebar-muted/70"
          )}
        >
          {item.caption}
        </span>
      </span>
    </Link>
  );
}

function SidebarContent({ onNavigate }) {
  const { logout } = useSuperAdmin();
  const { user } = useAuth();

  return (
    <div className="sa-grain flex h-full flex-col bg-sidebar bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,transparent_30%)]">
      {/* Marca */}
      <div className="flex items-center gap-3 px-6 pb-6 pt-7">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(140deg,#b25a28_0%,#8a4520_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_10px_24px_-8px_rgba(178,90,40,0.7)]">
          <ShieldCheck className="size-5" strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <p className="font-display text-[17px] font-semibold tracking-[-0.01em] text-white">
            Torre de control
          </p>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sidebar-muted">
            Superadmin
          </p>
        </div>
      </div>

      {/* Acción principal */}
      <div className="px-4">
        <Button asChild variant="brand" className="w-full">
          <Link href="/admin/superadmin/tenants/nuevo" onClick={onNavigate}>
            <Plus className="size-4" />
            Nuevo tenant
          </Link>
        </Button>
      </div>

      {/* Navegación */}
      <nav className="sa-scroll mt-7 flex-1 overflow-y-auto px-4">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-sidebar-muted/80">
          Panel
        </p>
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>

      {/* Sesión */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3.5 py-3 ring-1 ring-white/[0.06]">
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-sidebar-foreground">
              {user?.email || "Sesión maestra"}
            </p>
            <p className="text-[11px] text-sidebar-muted">Sesión activa · 10 min</p>
          </div>
          <button
            onClick={logout}
            title="Cerrar sesión"
            className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-sidebar-muted outline-none transition hover:bg-white/10 hover:text-white focus-visible:ring-4 focus-visible:ring-white/15"
          >
            <LogOut className="size-4" />
            <span className="sr-only">Cerrar sesión</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Shell({ title, children }) {
  const { sessionState } = useSuperAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  // Cierra el menú móvil al navegar
  useEffect(() => {
    const handleRoute = () => setMobileOpen(false);
    router.events.on("routeChangeComplete", handleRoute);
    return () => router.events.off("routeChangeComplete", handleRoute);
  }, [router.events]);

  if (sessionState === "checking") {
    return (
      <div className="sa-grain flex min-h-screen items-center justify-center bg-background">
        <div className="flex w-full max-w-sm flex-col gap-4 px-6">
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (sessionState === "locked") {
    return <AccessGate />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar de escritorio */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[276px] border-r border-black/20 lg:block">
        <SidebarContent />
      </aside>

      {/* Contenido */}
      <div className="sa-grain relative min-w-0 flex-1 lg:pl-[276px]">
        {/* Halos cálidos del lienzo */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(640px_400px_at_80%_-10%,rgba(178,90,40,0.07),transparent_60%),radial-gradient(520px_360px_at_-10%_30%,rgba(31,122,77,0.05),transparent_55%)]" />

        {/* Barra superior móvil */}
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/70 bg-background/85 px-4 py-3 backdrop-blur-md lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="Abrir menú">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle className="sr-only">Menú del superadmin</SheetTitle>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-[linear-gradient(140deg,#b25a28_0%,#8a4520_100%)] text-white">
              <ShieldCheck className="size-4" strokeWidth={1.8} />
            </div>
            <p className="font-display text-[15px] font-semibold tracking-[-0.01em] text-foreground">
              Torre de control
            </p>
          </div>
        </div>

        <main className="relative mx-auto w-full max-w-[1160px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Layout del superadmin: tema aislado (.superadmin), fuentes propias,
 * gate de sesión maestra y sidebar con navegación por páginas.
 */
export default function SuperAdminLayout({ title, children }) {
  return (
    <SuperAdminProvider>
      <Head>
        <title>{title ? `${title} · Superadmin` : "Superadmin"}</title>
        <meta name="description" content="Torre de control multi-tenant" />
      </Head>

      <div className={cn("superadmin min-h-screen bg-background text-foreground antialiased", fontVariables)}>
        <Shell title={title}>{children}</Shell>
      </div>

      {/* Contenedor de portales Radix: hereda tema y fuentes del superadmin */}
      <div id="sa-portal" className={cn("superadmin", fontVariables)} />
    </SuperAdminProvider>
  );
}
