"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Search,
  Cloud,
  LogOut,
  FolderKanban,
  FolderOpen,
  ShieldCheck,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";
import { ThemeToggle } from "@/shared/theme/ThemeToggle";

type Role = "admin" | "user" | null;

export default function Navbar({ role = null, name }: { role?: Role; name?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const canLogout = Boolean(role);
  const isAdmin = role === "admin";

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const res = await fetch("/api/logout", { method: "POST" });
      if (!res.ok) {
        const message = await res.text().catch(() => res.statusText);
        throw new Error(message || res.statusText);
      }
      router.push("/login");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "desconocido");
      alert(t("logout.error", { message }));
    } finally {
      setLoggingOut(false);
    }
  };

  const navLinks = [
    { href: "/", label: "Archivos", icon: FolderOpen, subtitle: "Explorador del equipo" },
    { href: "/project", label: "Proyectos", icon: FolderKanban, subtitle: "Carpetas del equipo" },
    ...(isAdmin
      ? [
          { href: "/admin", label: "Administración", icon: ShieldCheck, subtitle: "Usuarios y repositorio" },
        ]
      : []),
  ];

  const checkIsActive = (href: string) => {
    if (href === "/") {
      return pathname === "/" || pathname.startsWith("/files");
    }
    return pathname === href || pathname.startsWith(href);
  };

  // If the user is an administrator, render the floating left dock on desktop, and a compact top bar on mobile
  if (isAdmin) {
    return (
      <>
        {/* Mobile Top Header for Admin (screens < md) */}
        <header className="md:hidden sticky top-0 z-50 liquid-glass border-b border-zinc-200/80 dark:border-zinc-800/80">
          <div className="px-4 h-14 flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                <Cloud size={16} />
              </div>
              <span className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                OneDriveList
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300"
                aria-label="Menú principal"
              >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl space-y-2"
              >
                <div className="space-y-1">
                  {navLinks.map((link) => {
                    const active = checkIsActive(link.href);
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${
                          active
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                        }`}
                      >
                        <Icon size={16} />
                        <span>{link.label}</span>
                      </Link>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-zinc-500 font-medium">{name} (Admin)</span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="text-xs text-rose-600 font-semibold flex items-center gap-1"
                  >
                    <LogOut size={13} />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* Floating Left Navbar for Admin (Desktop / Screens >= md) */}
        <aside
          className={`hidden md:flex fixed left-3 top-3 bottom-3 z-50 liquid-glass rounded-2xl flex-col justify-between shadow-2xl border border-zinc-200/80 dark:border-zinc-800/80 transition-all duration-300 ${
            isExpanded ? "w-60 p-4" : "w-[72px] p-2 items-center"
          }`}
          aria-label="Barra de navegación flotante"
        >
          {/* Top section: Logo & Toggle */}
          <div className={`w-full flex flex-col ${isExpanded ? "items-start" : "items-center"} gap-3`}>
            <div className="w-full flex items-center justify-between">
              <Link
                href="/"
                className="flex items-center gap-2.5 group rounded-xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                title="OneDriveList - Repositorio del equipo"
              >
                <motion.div
                  whileHover={{ rotate: 12, scale: 1.08 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 shrink-0"
                >
                  <Cloud size={20} className="stroke-[2.2]" />
                </motion.div>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-col min-w-0"
                  >
                    <span className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                      OneDriveList
                    </span>
                    <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider -mt-0.5">
                      Team Drive
                    </span>
                  </motion.div>
                )}
              </Link>

              {/* Expand / Collapse Button */}
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className={`p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60 transition-colors ${
                  !isExpanded && "hidden"
                }`}
                title="Contraer barra"
              >
                <ChevronLeft size={16} />
              </button>
            </div>

            {/* Expand button when collapsed */}
            {!isExpanded && (
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="w-full py-1.5 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 transition-colors"
                title="Expandir barra de navegación"
                aria-label="Expandir menú lateral"
              >
                <ChevronRight size={15} />
              </button>
            )}
          </div>

          {/* Navigation Links in Center */}
          <nav className="w-full flex flex-col gap-2 my-auto" aria-label="Navegación principal">
            {navLinks.map((link) => {
              const active = checkIsActive(link.href);
              const Icon = link.icon;
              return (
                <div key={link.href} className="relative group w-full flex justify-center">
                  <Link
                    href={link.href}
                    className={`relative flex items-center transition-all duration-150 ${
                      isExpanded
                        ? "w-full gap-3 px-3.5 py-2.5 rounded-xl justify-start text-xs font-semibold"
                        : "w-11 h-11 rounded-xl justify-center"
                    } ${
                      active
                        ? "bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30 font-bold"
                        : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60"
                    }`}
                  >
                    <Icon size={20} className={`shrink-0 ${active ? "text-white" : "opacity-80 group-hover:opacity-100"}`} />
                    {isExpanded && (
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{link.label}</span>
                        <span className="text-[10px] font-normal opacity-70 truncate">{link.subtitle}</span>
                      </div>
                    )}
                  </Link>

                  {/* Clean Tooltip on hover when collapsed - NO overflowing letters! */}
                  {!isExpanded && (
                    <div className="absolute left-[72px] top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl liquid-glass text-xs font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap shadow-xl border border-zinc-200/80 dark:border-zinc-800 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                      {link.label}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Quick Search Trigger */}
            <div className="relative group w-full mt-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 flex justify-center">
              <Link
                href="/search"
                className={`relative flex items-center transition-colors ${
                  isExpanded
                    ? "w-full gap-3 px-3.5 py-2.5 rounded-xl justify-start text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60"
                    : "w-11 h-11 rounded-xl justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60"
                }`}
                title="Buscar archivos"
              >
                <Search size={19} className="shrink-0 opacity-80 group-hover:opacity-100" />
                {isExpanded && <span>Buscar</span>}
              </Link>

              {!isExpanded && (
                <div className="absolute left-[72px] top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl liquid-glass text-xs font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap shadow-xl border border-zinc-200/80 dark:border-zinc-800 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                  Buscar archivos
                </div>
              )}
            </div>
          </nav>

          {/* Bottom section: Theme, User & Logout */}
          <div className="w-full flex flex-col items-center gap-2 pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60">
            <div className="relative group w-full flex justify-center">
              <ThemeToggle />
              {!isExpanded && (
                <div className="absolute left-[72px] top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl liquid-glass text-xs font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap shadow-xl border border-zinc-200/80 dark:border-zinc-800 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                  Cambiar tema
                </div>
              )}
            </div>

            {/* User Pill / Avatar */}
            {name && (
              <div
                className={`relative group flex items-center ${
                  isExpanded ? "gap-2.5 w-full p-2 bg-zinc-100/60 dark:bg-zinc-900/60 rounded-xl" : "justify-center py-1"
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  {name.charAt(0).toUpperCase()}
                </div>
                {isExpanded && (
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{name}</span>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Administrador
                    </span>
                  </div>
                )}
                {!isExpanded && (
                  <div className="absolute left-[72px] top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl liquid-glass text-xs font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap shadow-xl border border-zinc-200/80 dark:border-zinc-800 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                    {name} (Admin)
                  </div>
                )}
              </div>
            )}

            {/* Logout Button */}
            {canLogout && (
              <div className="relative group w-full flex justify-center">
                <motion.button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.94 }}
                  className={`flex items-center justify-center gap-2 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 hover:bg-rose-50 dark:bg-zinc-900 dark:hover:bg-rose-950/30 text-zinc-600 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 transition-colors shadow-xs disabled:opacity-50 ${
                    isExpanded ? "w-full py-2.5 px-3" : "w-10 h-10"
                  }`}
                  aria-label={t("logout")}
                >
                  {loggingOut ? (
                    <span className="block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <LogOut size={16} />
                  )}
                  {isExpanded && <span className="text-xs font-semibold">Cerrar sesión</span>}
                </motion.button>

                {!isExpanded && (
                  <div className="absolute left-[72px] top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl liquid-glass text-xs font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap shadow-xl border border-zinc-200/80 dark:border-zinc-800 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                    Cerrar sesión
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </>
    );
  }

  // Regular User Horizontal Top Navbar
  return (
    <header className="sticky top-0 z-50 liquid-glass border-x-0 border-t-0 border-b border-zinc-200/80 dark:border-zinc-800/80 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand & Links */}
        <div className="flex items-center gap-5 md:gap-7">
          <Link href="/" className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl py-1">
            <motion.div
              whileHover={{ rotate: 12, scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20"
            >
              <Cloud className="w-5 h-5 stroke-[2.2]" />
            </motion.div>
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100 group-hover:opacity-85 transition-opacity">
                OneDriveList
              </span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold tracking-wider uppercase -mt-0.5">
                Team Drive
              </span>
            </div>
          </Link>

          {/* Navigation Items - Desktop */}
          <nav aria-label="Navegación principal" className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = checkIsActive(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 flex items-center gap-2 ${
                    isActive
                      ? "text-zinc-950 dark:text-white font-semibold"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNavIndicator"
                      className="absolute inset-0 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl -z-10 shadow-xs border border-emerald-500/30"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-emerald-600 dark:text-emerald-400 opacity-100" : "opacity-70"}`} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side: Search, Theme Toggle, User, Logout, Mobile toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Search Bar */}
          <form
            action="/search"
            method="GET"
            className="relative hidden md:flex items-center"
          >
            <div className="relative group">
              <input
                type="text"
                name="q"
                placeholder={t("search.placeholder")}
                className="w-44 lg:w-56 pl-8 pr-3 py-1.5 rounded-xl text-xs liquid-glass-pill text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:w-64 transition-all duration-200"
              />
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors pointer-events-none" />
            </div>
          </form>

          {/* Theme Switcher Toggle */}
          <ThemeToggle />

          {/* User Profile Pill */}
          {name && (
            <div className="hidden sm:flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full liquid-glass-pill text-xs border border-zinc-200/60 dark:border-zinc-800/60">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center font-bold text-[11px] shadow-xs">
                {name.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium text-zinc-700 dark:text-zinc-300 max-w-[120px] truncate text-[11px]">
                {name}
              </span>
            </div>
          )}

          {/* Logout Button */}
          {canLogout && (
            <motion.button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              className="p-2 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 hover:bg-rose-50 dark:bg-zinc-900/80 dark:hover:bg-rose-950/30 text-zinc-600 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 transition-colors shadow-xs disabled:opacity-50"
              aria-label={t("logout")}
              title={t("logout")}
            >
              {loggingOut ? (
                <span className="block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
            </motion.button>
          )}

          {/* Mobile menu trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Abrir menú"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer for User */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl"
          >
            <div className="space-y-1 mb-3">
              {navLinks.map((link) => {
                const isActive = checkIsActive(link.href);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300 font-semibold"
                        : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>

            <form
              action="/search"
              method="GET"
              className="relative mt-2"
              onSubmit={() => setMobileMenuOpen(false)}
            >
              <input
                type="text"
                name="q"
                placeholder={t("search.placeholder")}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
