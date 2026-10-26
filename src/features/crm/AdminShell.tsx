"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Activity,
  Cloud,
  Trash2,
  FolderOpen,
  ArrowUpRight,
  Folders,
  ChevronRight,
  Menu,
  X,
  GraduationCap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;
  description?: string;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    group: "Operaciones",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, description: "Resumen y métricas" },
      { href: "/admin/projects", label: "Proyectos", icon: Folders, description: "Equipos y carpetas" },
    ],
  },
  {
    group: "Control de Acceso",
    items: [
      { href: "/admin/users", label: "Usuarios", icon: Users, description: "Cuentas y carpetas" },
      { href: "/admin/roles", label: "Roles y permisos", icon: ShieldCheck, description: "Políticas globales" },
    ],
  },
  {
    group: "Auditoría & Sistema",
    items: [
      { href: "/admin/activity", label: "Actividad", icon: Activity, description: "Registro de eventos" },
      { href: "/admin/trash", label: "Papelera", icon: Trash2, description: "Recuperar archivos" },
      { href: "/admin/storage", label: "Almacenamiento", icon: Cloud, description: "Conexión con OneDrive" },
    ],
  },
];

const allItems = navGroups.flatMap((g) => g.items);

export default function AdminShell({
  children,
  name,
}: {
  children: React.ReactNode;
  name: string;
}) {
  const pathname = usePathname();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const isCurrent = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const currentItem = allItems.find((item) => isCurrent(item.href)) ?? allItems[0];

  return (
    <div className="crm-shell min-h-screen flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 sticky top-14 z-30">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
            aria-label="Alternar menú de administración"
          >
            {mobileDrawerOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {currentItem.label}
            </span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Panel de Administración</span>
          </div>
        </div>
        <Link
          href="/"
          className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline"
        >
          <FolderOpen size={13} />
          <span>Archivos</span>
        </Link>
      </div>

      {/* Desktop / Large Screen Sidebar */}
      <aside className="crm-sidebar hidden md:flex md:w-64 lg:w-72 shrink-0 border-r border-zinc-200/80 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-2xl flex-col p-5 sticky top-0 h-screen overflow-y-auto">
        {/* Brand & Section Header */}
        <div className="mb-6 px-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300 border border-emerald-500/20">
              Admin Suite
            </span>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Administración
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Gestión del repositorio
          </p>
        </div>

        {/* Grouped Navigation */}
        <nav className="crm-navigation flex flex-col gap-6 flex-1" aria-label="Panel de administración">
          {navGroups.map((group) => (
            <div key={group.group} className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-3 mb-1">
                {group.group}
              </span>
              {group.items.map(({ href, label, icon: Icon, description }) => {
                const active = isCurrent(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                      active
                        ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 font-semibold"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/80 dark:hover:bg-zinc-900/60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        size={16}
                        className={`shrink-0 transition-transform group-hover:scale-110 ${
                          active ? "text-white" : "text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200"
                        }`}
                        aria-hidden="true"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{label}</span>
                        {!active && description && (
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal truncate">
                            {description}
                          </span>
                        )}
                      </div>
                    </div>
                    {active && <ChevronRight size={14} className="text-white/80 shrink-0" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="crm-sidebar-footer pt-4 mt-auto border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-2">
          <Link
            href="/"
            className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/70 dark:hover:bg-zinc-900/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <FolderOpen size={14} className="text-zinc-400" />
              Archivos compartidos
            </span>
            <ArrowUpRight size={13} className="text-zinc-400" />
          </Link>
          <Link
            href="/project"
            className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/70 dark:hover:bg-zinc-900/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <GraduationCap size={14} className="text-zinc-400" />
              Proyectos
            </span>
            <ArrowUpRight size={13} className="text-zinc-400" />
          </Link>

          {/* Admin profile snippet */}
          <div className="pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60 px-2 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                {name.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{name}</span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Sesión de administrador</span>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" title="En línea" />
          </div>
        </div>
      </aside>

      {/* Mobile Drawer (Overlay) */}
      <AnimatePresence>
        {mobileDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileDrawerOpen(false)}
              className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-xs z-40"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="md:hidden fixed inset-y-0 left-0 w-72 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 p-5 z-50 flex flex-col overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                    A
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Panel de Control</span>
                    <span className="text-[10px] text-zinc-500">Administrador</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-5 flex-1">
                {navGroups.map((group) => (
                  <div key={group.group}>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-3 mb-1 block">
                      {group.group}
                    </span>
                    <div className="space-y-1">
                      {group.items.map(({ href, label, icon: Icon }) => {
                        const active = isCurrent(href);
                        return (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setMobileDrawerOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium ${
                              active
                                ? "bg-emerald-600 text-white font-semibold"
                                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                            }`}
                          >
                            <Icon size={16} />
                            <span>{label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2 mt-4">
                <Link
                  href="/"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 py-1.5"
                >
                  <FolderOpen size={14} />
                  <span>Archivos compartidos</span>
                </Link>
                <Link
                  href="/project"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 py-1.5"
                >
                  <GraduationCap size={14} />
                  <span>Proyectos</span>
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="crm-content flex-1 min-w-0">
        {/* Top Breadcrumb Bar */}
        <div className="hidden md:flex items-center justify-between px-6 lg:px-8 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/40 dark:bg-zinc-950/40 backdrop-blur-md">
          <nav aria-label="Ruta de navegación" className="flex items-center gap-2 text-xs">
            <Link href="/admin" className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors">
              Administración
            </Link>
            <ChevronRight size={13} className="text-zinc-400" />
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <currentItem.icon size={14} className="text-emerald-600 dark:text-emerald-400" />
              {currentItem.label}
            </span>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 hidden xl:inline">
              Repositorio · Sesión activa
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
