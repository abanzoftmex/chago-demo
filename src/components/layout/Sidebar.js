import { useRouter } from "next/router";
import React, { useEffect } from "react";
import { useAuth } from "../../context/AuthContextMultiTenant";
import useSidebarStore from "../../lib/stores/sidebarStore";
import { useLogoUrl } from "../../lib/hooks/useLogoUrl";
import {
  HomeIcon,
  DocumentTextIcon,
  PlusIcon,
  MinusIcon,
  ClockIcon,
  UserGroupIcon,
  TagIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  CogIcon,
  XMarkIcon,
  UsersIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

/** En false oculta el ítem Reportes del menú (la página sigue en /admin/reportes). */
const SHOW_REPORTES_IN_NAV = true;

const Sidebar = ({
  isOpen,
  collapsed,
  onClose,
  onToggleCollapse,
  isMobile,
}) => {
  const router = useRouter();
  const { checkPermission, userRole } = useAuth();
  const { logoUrl, isLoading: logoLoading } = useLogoUrl();



  // Usar el store de Zustand para el estado de los menús
  const { expandedSections, toggleSection, autoExpandFromPath } = useSidebarStore();

  const handleSectionClick = (section, fallbackUrl = null) => {
    // Si la sección está colapsada, la expandimos
    if (!expandedSections[section]) {
      toggleSection(section);
    } else if (fallbackUrl) {
      // Si está expandida y tenemos una URL de respaldo, navegamos a ella
      handleNavigation(fallbackUrl);
    } else {
      // Si no hay URL de respaldo, solo colapsamos/expandimos
      toggleSection(section);
    }
  };

  // Efecto para expandir automáticamente la sección actual basada en la ruta
  useEffect(() => {
    autoExpandFromPath(router.pathname);
  }, [router.pathname, autoExpandFromPath]);

  const handleNavigation = (href) => {
    router.push(href);
    // Solo cerrar el sidebar en móvil, no colapsar las secciones del menú
    if (isMobile) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Desktop sidebar */}
      <div
        className={`hidden lg:flex lg:flex-shrink-0 transition-all duration-300 ${collapsed ? "lg:w-16" : "lg:w-64"
          }`}
      >
        <div className="flex flex-col w-full h-screen overflow-hidden bg-white border-r border-gray-200">
          {/* Logo */}
          <div className="flex items-center justify-center mb-4 mt-4 px-2 flex-shrink-0">
            {logoLoading ? (
              <div className={`rounded-2xl shadow-md bg-gray-100 animate-pulse ${collapsed ? 'w-10 h-10' : 'w-[120px] h-[60px]'}`} />
            ) : logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className={`h-auto rounded-2xl shadow-md ${collapsed ? 'w-full' : 'max-w-[120px]'}`}
              />
            ) : (
              <div className={`flex items-center justify-center rounded-2xl shadow-md bg-primary text-white font-bold tracking-widest ${collapsed ? 'w-10 h-10 text-xs' : 'w-[120px] h-[60px] text-xl'}`}>
                EYS
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-6 space-y-2">
            {/* 1. Dashboard */}
            <button
              onClick={() => handleNavigation("/admin/dashboard")}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/dashboard"
                ? "bg-[#5a5e68] text-[#ededed]"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
            >
              <HomeIcon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span className="ml-3">Dashboard</span>}
            </button>

            {/* 2. Catálogos Section (incluye Gestión de Catálogos) */}
            {!collapsed &&
              (checkPermission("canManageProviders") ||
                checkPermission("canManageConcepts") ||
                checkPermission("canManageDescriptions") ||
                checkPermission("canManageSettings")) && (
                <div className="space-y-1">
                  <button
                    onClick={() => handleSectionClick('catalogos')}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <div className="flex items-center">
                      <TagIcon className="h-5 w-5 flex-shrink-0" />
                      <span className="ml-3">Catálogos</span>
                    </div>
                    {expandedSections.catalogos ? (
                      <ChevronDownIcon className="h-4 w-4" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4" />
                    )}
                  </button>

                  {/* Submenú de Catálogos */}
                  {expandedSections.catalogos && (
                    <div className="space-y-1 transition-all duration-300 ease-in-out">
                      {/* Proveedores - Admin y Contador pueden ver */}
                      {checkPermission("canManageProviders") && (
                        <button
                          onClick={() =>
                            handleNavigation("/admin/catalogos/proveedores")
                          }
                          className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/catalogos/proveedores"
                            ? "bg-[#5a5e68] text-[#ededed]"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            }`}
                        >
                          <UserGroupIcon className="h-5 w-5 flex-shrink-0" />
                          <span className="ml-3">Proveedores</span>
                        </button>
                      )}

                      {/* Generales - Solo Admin */}
                      {checkPermission("canManageConcepts") && (
                        <button
                          onClick={() =>
                            handleNavigation("/admin/catalogos/generales")
                          }
                          className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/catalogos/generales"
                            ? "bg-[#5a5e68] text-[#ededed]"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            }`}
                        >
                          <TagIcon className="h-5 w-5 flex-shrink-0" />
                          <span className="ml-3">Generales</span>
                        </button>
                      )}

                      {/* Conceptos - Solo Admin */}
                      {checkPermission("canManageConcepts") && (
                        <button
                          onClick={() =>
                            handleNavigation("/admin/catalogos/conceptos")
                          }
                          className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/catalogos/conceptos"
                            ? "bg-[#5a5e68] text-[#ededed]"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            }`}
                        >
                          <TagIcon className="h-5 w-5 flex-shrink-0" />
                          <span className="ml-3">Conceptos</span>
                        </button>
                      )}

                      {/* Subconceptos - Solo Admin */}
                      {checkPermission("canManageDescriptions") && (
                        <button
                          onClick={() =>
                            handleNavigation("/admin/catalogos/subconceptos")
                          }
                          className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/catalogos/subconceptos"
                            ? "bg-[#5a5e68] text-[#ededed]"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            }`}
                        >
                          <TagIcon className="h-5 w-5 flex-shrink-0" />
                          <span className="ml-3">Subconceptos</span>
                        </button>
                      )}

                      {/* Gestión de Catálogos - Solo Admin */}
                      {checkPermission("canManageSettings") && (
                        <button
                          onClick={() =>
                            handleNavigation("/admin/configuracion/catalogos")
                          }
                          className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/configuracion/catalogos"
                            ? "bg-[#5a5e68] text-[#ededed]"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            }`}
                        >
                          <CogIcon className="h-5 w-5 flex-shrink-0" />
                          <span className="ml-3">Gestión de Catálogos</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

            {/* 3. Transacciones Section (incluye Recurrentes) */}
            {!collapsed &&
              (checkPermission("canViewEntradas") ||
                checkPermission("canViewSalidas") ||
                checkPermission("canViewHistorial") ||
                checkPermission("canManageTransactions")) && (
                <div className="space-y-1">
                  <button
                    onClick={() => handleSectionClick('transacciones')}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <div className="flex items-center">
                      <DocumentTextIcon className="h-5 w-5 flex-shrink-0" />
                      <span className="ml-3">Transacciones</span>
                    </div>
                    {expandedSections.transacciones ? (
                      <ChevronDownIcon className="h-4 w-4" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4" />
                    )}
                  </button>

                  {/* Submenú de Transacciones */}
                  {expandedSections.transacciones && (
                    <div className="space-y-1 transition-all duration-300 ease-in-out">
                      {/* Ingresos - Solo si tiene permiso */}
                      {checkPermission("canViewEntradas") && (
                        <button
                          onClick={() =>
                            handleNavigation("/admin/transacciones/entradas")
                          }
                          className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/transacciones/entradas"
                            ? "bg-[#5a5e68] text-[#ededed]"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            }`}
                        >
                          <PlusIcon className="h-5 w-5 flex-shrink-0" />
                          <span className="ml-3">Entradas</span>
                        </button>
                      )}

                      {/* Solicitudes de Pago - Solo si tiene permiso */}
                      {checkPermission("canViewSalidas") && (
                        <button
                          onClick={() =>
                            handleNavigation("/admin/transacciones/salidas")
                          }
                          className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/transacciones/salidas"
                            ? "bg-[#5a5e68] text-[#ededed]"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            }`}
                        >
                          <MinusIcon className="h-5 w-5 flex-shrink-0" />
                          <span className="ml-3">Salidas</span>
                        </button>
                      )}

                      {/* Historial - Solo si tiene permiso */}
                      {checkPermission("canViewHistorial") && (
                        <button
                          onClick={() =>
                            handleNavigation("/admin/transacciones/historial")
                          }
                          className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/transacciones/historial"
                            ? "bg-[#5a5e68] text-[#ededed]"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            }`}
                        >
                          <ClockIcon className="h-5 w-5 flex-shrink-0" />
                          <span className="ml-3">Historial</span>
                        </button>
                      )}

                      {/* Entradas Recurrentes - Solo si puede gestionar */}
                      {checkPermission("canManageTransactions") && (
                        <button
                          onClick={() =>
                            handleNavigation("/admin/transacciones/entradas-recurrentes")
                          }
                          className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/transacciones/entradas-recurrentes"
                            ? "bg-[#5a5e68] text-[#ededed]"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            }`}
                        >
                          <ArrowPathIcon className="h-5 w-5 flex-shrink-0" />
                          <span className="ml-3">Entradas Recurrentes</span>
                        </button>
                      )}

                      {/* Salidas Recurrentes - Solo si puede gestionar */}
                      {checkPermission("canManageTransactions") && (
                        <button
                          onClick={() =>
                            handleNavigation("/admin/transacciones/recurrentes")
                          }
                          className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/transacciones/recurrentes"
                            ? "bg-[#5a5e68] text-[#ededed]"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            }`}
                        >
                          <ArrowPathIcon className="h-5 w-5 flex-shrink-0" />
                          <span className="ml-3">Salidas Recurrentes</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

            {/* 4. Reportes - Solo Admin (oculto temporalmente: SHOW_REPORTES_IN_NAV) */}
            {SHOW_REPORTES_IN_NAV && checkPermission("canViewReports") && (
              <button
                onClick={() => handleNavigation("/admin/reportes")}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/reportes"
                  ? "bg-[#5a5e68] text-[#ededed]"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
              >
                <ChartBarIcon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span className="ml-3">Reportes</span>}
              </button>
            )}

            {/* 5. Análisis con IA - Solo Administrativo */}
            {checkPermission("canViewAnalisisIA") && (
              <button
                onClick={() => handleNavigation("/admin/analisis-ia")}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/analisis-ia"
                  ? "bg-[#5a5e68] text-[#ededed]"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
              >
                <SparklesIcon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span className="ml-3">Análisis IA</span>}
              </button>
            )}

            {/* 6. Configuración Section - Solo Admin */}
            {checkPermission("canManageSettings") &&
              (!collapsed ? (
                <div className="space-y-1">
                  <button
                    onClick={() => handleSectionClick('configuracion')}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <div className="flex items-center">
                      <CogIcon className="h-5 w-5 flex-shrink-0" />
                      <span className="ml-3">Configuración</span>
                    </div>
                    {expandedSections.configuracion ? (
                      <ChevronDownIcon className="h-4 w-4" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4" />
                    )}
                  </button>

                  {/* Submenú de Configuración */}
                  {expandedSections.configuracion && (
                    <div className="space-y-1 transition-all duration-300 ease-in-out">
                      <button
                        onClick={() =>
                          handleNavigation("/admin/configuracion/logo")
                        }
                        className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/configuracion/logo"
                          ? "bg-[#5a5e68] text-[#ededed]"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                          }`}
                      >
                        <span className="ml-3">Logo</span>
                      </button>
                      <button
                        onClick={() =>
                          handleNavigation(
                            "/admin/configuracion/correos-notificacion"
                          )
                        }
                        className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname ===
                          "/admin/configuracion/correos-notificacion"
                          ? "bg-[#5a5e68] text-[#ededed]"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                          }`}
                      >
                        <span className="ml-3">Correos de notificación</span>
                      </button>
                      <button
                        onClick={() =>
                          handleNavigation(
                            "/admin/configuracion/logs"
                          )
                        }
                        className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname ===
                          "/admin/configuracion/logs"
                          ? "bg-[#5a5e68] text-[#ededed]"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                          }`}
                      >
                        <span className="ml-3">Registros de actividad</span>
                      </button>
                      {/* Dev Tools - Only in development */}
                      {process.env.NODE_ENV === 'development' && (
                        <button
                          onClick={() =>
                            handleNavigation(
                              "/admin/configuracion/dev-tools"
                            )
                          }
                          className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname ===
                            "/admin/configuracion/dev-tools"
                            ? "bg-[#5a5e68] text-[#ededed]"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            }`}
                        >
                          <span className="ml-3">🛠️ Dev Tools</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => handleNavigation("/admin/configuracion")}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/configuracion"
                    ? "bg-[#5a5e68] text-[#ededed]"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                >
                  <CogIcon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span className="ml-3">Configuración</span>}
                </button>
              ))}

            {/* Gestión de Usuarios - Solo Admin */}
            {checkPermission("canManageUsers") && (
              <button
                onClick={() => handleNavigation("/admin/usuarios")}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/usuarios"
                  ? "bg-[#5a5e68] text-[#ededed]"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
              >
                <UsersIcon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span className="ml-3">Usuarios</span>}
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* Mobile sidebar */}
      <div
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-center px-4 py-6 border-b border-gray-200 relative flex-shrink-0">
            {logoLoading ? (
              <div className="w-[120px] h-[60px] rounded-2xl shadow-md bg-gray-100 animate-pulse" />
            ) : logoUrl ? (
              <img src={logoUrl} alt="Logo" className="max-w-[120px] h-auto rounded-2xl shadow-md" />
            ) : (
              <div className="flex items-center justify-center w-[120px] h-[60px] rounded-2xl shadow-md bg-primary text-white font-bold text-xl tracking-widest">
                EYS
              </div>
            )}
            <button
              onClick={onClose}
              className="absolute top-6 right-4 p-2 rounded-lg text-gray-500 hover:text-gray-700"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Mobile Navigation */}
          <nav className="flex-1 min-h-0 px-3 py-6 space-y-2 overflow-y-auto">
            {/* 1. Dashboard */}
            <button
              onClick={() => handleNavigation("/admin/dashboard")}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/dashboard"
                ? "bg-[#5a5e68] text-[#ededed]"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
            >
              <HomeIcon className="h-5 w-5 flex-shrink-0" />
              <span className="ml-3">Dashboard</span>
            </button>

            {/* 2. Catálogos Section (incluye Gestión de Catálogos) */}
            {(checkPermission("canManageProviders") ||
              checkPermission("canManageConcepts") ||
              checkPermission("canManageDescriptions") ||
              checkPermission("canManageSettings")) && (
                <div className="space-y-1">
                  <button
                    onClick={() => handleSectionClick('catalogos')}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <div className="flex items-center">
                      <TagIcon className="h-5 w-5 flex-shrink-0" />
                      <span className="ml-3">Catálogos</span>
                    </div>
                    {expandedSections.catalogos ? (
                      <ChevronDownIcon className="h-4 w-4" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4" />
                    )}
                  </button>

                  {/* Submenú de Catálogos */}
                  {expandedSections.catalogos && (
                    <div className="space-y-1 transition-all duration-300 ease-in-out">
                      {checkPermission("canManageProviders") && (
                        <button
                          onClick={() =>
                            handleNavigation("/admin/catalogos/proveedores")
                          }
                          className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/catalogos/proveedores"
                            ? "bg-[#5a5e68] text-[#ededed]"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            }`}
                        >
                          <UserGroupIcon className="h-5 w-5 flex-shrink-0" />
                          <span className="ml-3">Proveedores</span>
                        </button>
                      )}

                      {checkPermission("canManageConcepts") && (
                        <button
                          onClick={() =>
                            handleNavigation("/admin/catalogos/generales")
                          }
                          className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/catalogos/generales"
                            ? "bg-[#5a5e68] text-[#ededed]"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            }`}
                        >
                          <TagIcon className="h-5 w-5 flex-shrink-0" />
                          <span className="ml-3">Generales</span>
                        </button>
                      )}

                      {checkPermission("canManageConcepts") && (
                        <button
                          onClick={() =>
                            handleNavigation("/admin/catalogos/conceptos")
                          }
                          className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/catalogos/conceptos"
                            ? "bg-[#5a5e68] text-[#ededed]"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            }`}
                        >
                          <TagIcon className="h-5 w-5 flex-shrink-0" />
                          <span className="ml-3">Conceptos</span>
                        </button>
                      )}

                      {checkPermission("canManageDescriptions") && (
                        <button
                          onClick={() =>
                            handleNavigation("/admin/catalogos/subconceptos")
                          }
                          className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/catalogos/subconceptos"
                            ? "bg-[#5a5e68] text-[#ededed]"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            }`}
                        >
                          <ChatBubbleLeftRightIcon className="h-5 w-5 flex-shrink-0" />
                          <span className="ml-3">Subconceptos</span>
                        </button>
                      )}

                      {checkPermission("canManageSettings") && (
                        <button
                          onClick={() =>
                            handleNavigation("/admin/configuracion/catalogos")
                          }
                          className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/configuracion/catalogos"
                            ? "bg-[#5a5e68] text-[#ededed]"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            }`}
                        >
                          <CogIcon className="h-5 w-5 flex-shrink-0" />
                          <span className="ml-3">Gestión de Catálogos</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

            {/* 3. Transacciones Section (incluye Recurrentes) */}
            {(checkPermission("canViewEntradas") ||
              checkPermission("canViewSalidas") ||
              checkPermission("canViewHistorial") ||
              checkPermission("canManageTransactions")) && (
                <div className="space-y-1">
                  <button
                    onClick={() => handleSectionClick('transacciones')}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <div className="flex items-center">
                      <DocumentTextIcon className="h-5 w-5 flex-shrink-0" />
                      <span className="ml-3">Transacciones</span>
                    </div>
                    {expandedSections.transacciones ? (
                      <ChevronDownIcon className="h-4 w-4" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4" />
                    )}
                  </button>

                  {/* Submenú de Transacciones */}
                  {expandedSections.transacciones && (
                    <div className="space-y-1 transition-all duration-300 ease-in-out">
                      {checkPermission("canViewEntradas") && (
                        <button
                          onClick={() =>
                            handleNavigation("/admin/transacciones/entradas")
                          }
                          className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/transacciones/entradas"
                            ? "bg-[#5a5e68] text-[#ededed]"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            }`}
                        >
                          <PlusIcon className="h-5 w-5 flex-shrink-0" />
                          <span className="ml-3">Entradas</span>
                        </button>
                      )}

                      {checkPermission("canViewSalidas") && (
                        <button
                          onClick={() =>
                            handleNavigation("/admin/transacciones/salidas")
                          }
                          className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/transacciones/salidas"
                            ? "bg-[#5a5e68] text-[#ededed]"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            }`}
                        >
                          <MinusIcon className="h-5 w-5 flex-shrink-0" />
                          <span className="ml-3">Salidas</span>
                        </button>
                      )}

                      {checkPermission("canViewHistorial") && (
                        <button
                          onClick={() =>
                            handleNavigation("/admin/transacciones/historial")
                          }
                          className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/transacciones/historial"
                            ? "bg-[#5a5e68] text-[#ededed]"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            }`}
                        >
                          <ClockIcon className="h-5 w-5 flex-shrink-0" />
                          <span className="ml-3">Historial</span>
                        </button>
                      )}

                      {/* Entradas Recurrentes - Solo si puede gestionar */}
                      {checkPermission("canManageTransactions") && (
                        <button
                          onClick={() =>
                            handleNavigation("/admin/transacciones/entradas-recurrentes")
                          }
                          className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/transacciones/entradas-recurrentes"
                            ? "bg-[#5a5e68] text-[#ededed]"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            }`}
                        >
                          <ArrowPathIcon className="h-5 w-5 flex-shrink-0" />
                          <span className="ml-3">Entradas Recurrentes</span>
                        </button>
                      )}

                      {/* Salidas Recurrentes - Solo si puede gestionar */}
                      {checkPermission("canManageTransactions") && (
                        <button
                          onClick={() =>
                            handleNavigation("/admin/transacciones/recurrentes")
                          }
                          className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/transacciones/recurrentes"
                            ? "bg-[#5a5e68] text-[#ededed]"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            }`}
                        >
                          <ArrowPathIcon className="h-5 w-5 flex-shrink-0" />
                          <span className="ml-3">Salidas Recurrentes</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

            {/* 4. Reportes */}
            {SHOW_REPORTES_IN_NAV && checkPermission("canViewReports") && (
              <button
                onClick={() => handleNavigation("/admin/reportes")}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/reportes"
                  ? "bg-[#5a5e68] text-[#ededed]"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
              >
                <ChartBarIcon className="h-5 w-5 flex-shrink-0" />
                <span className="ml-3">Reportes</span>
              </button>
            )}

            {/* 5. Análisis con IA (mobile) - Admin y Viewer */}
            {(checkPermission("canViewReports") || checkPermission("canViewEntradas")) && (
              <button
                onClick={() => handleNavigation("/admin/analisis-ia")}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/analisis-ia"
                  ? "bg-[#5a5e68] text-[#ededed]"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
              >
                <SparklesIcon className="h-5 w-5 flex-shrink-0" />
                <span className="ml-3">Análisis IA</span>
              </button>
            )}

            {/* 6. Configuración Section (mobile) - Solo Admin */}
            {checkPermission("canManageSettings") && (
              <div className="space-y-1">
                <button
                  onClick={() => handleSectionClick('configuracion')}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <div className="flex items-center">
                    <CogIcon className="h-5 w-5 flex-shrink-0" />
                    <span className="ml-3">Configuración</span>
                  </div>
                  {expandedSections.configuracion ? (
                    <ChevronDownIcon className="h-4 w-4" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4" />
                  )}
                </button>

                {/* Submenú de Configuración */}
                {expandedSections.configuracion && (
                  <div className="space-y-1">
                    <button
                      onClick={() =>
                        handleNavigation("/admin/configuracion/logo")
                      }
                      className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/configuracion/logo"
                        ? "bg-[#5a5e68] text-[#ededed]"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        }`}
                    >
                      <span className="ml-3">Logo</span>
                    </button>
                    <button
                      onClick={() =>
                        handleNavigation(
                          "/admin/configuracion/correos-notificacion"
                        )
                      }
                      className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname ===
                        "/admin/configuracion/correos-notificacion"
                        ? "bg-[#5a5e68] text-[#ededed]"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        }`}
                    >
                      <span className="ml-3">Correos de notificación</span>
                    </button>
                    <button
                      onClick={() =>
                        handleNavigation(
                          "/admin/configuracion/logs"
                        )
                      }
                      className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname ===
                        "/admin/configuracion/logs"
                        ? "bg-[#5a5e68] text-[#ededed]"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        }`}
                    >
                      <span className="ml-3">Registros de actividad</span>
                    </button>
                    {/* Dev Tools - Only in development */}
                    {process.env.NODE_ENV === 'development' && (
                      <button
                        onClick={() =>
                          handleNavigation(
                            "/admin/configuracion/dev-tools"
                          )
                        }
                        className={`w-full flex items-center px-3 py-2 pl-10 text-sm font-medium rounded-lg transition-colors ${router.pathname ===
                          "/admin/configuracion/dev-tools"
                          ? "bg-[#5a5e68] text-[#ededed]"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                          }`}
                      >
                        <span className="ml-3">🛠️ Dev Tools</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Gestión de Usuarios (mobile) - Solo Admin */}
            {checkPermission("canManageUsers") && (
              <button
                onClick={() => handleNavigation("/admin/usuarios")}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${router.pathname === "/admin/usuarios"
                  ? "bg-[#5a5e68] text-[#ededed]"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
              >
                <UsersIcon className="h-5 w-5 flex-shrink-0" />
                <span className="ml-3">Usuarios</span>
              </button>
            )}
          </nav>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
