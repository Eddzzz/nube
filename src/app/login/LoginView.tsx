"use client";

import { useActionState } from "react";
import { Cloud, LockKeyhole, LogIn, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/shared/theme/ThemeToggle";

export default function LoginUI({
  loginAction,
  nextPath,
}: {
  nextPath?: string;
  loginAction: (formData: FormData) => Promise<{ error?: string } | undefined>;
}) {
  const [state, action, pending] = useActionState(
    async (_state: { error?: string }, data: FormData) => (await loginAction(data)) || {},
    {}
  );

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 bg-radial-[at_top] from-emerald-500/5 via-zinc-50 to-zinc-100 dark:from-emerald-950/20 dark:via-zinc-950 dark:to-zinc-950 overflow-hidden">
      {/* Ambient background decoration */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-emerald-500/10 dark:from-emerald-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* Top right theme toggle */}
      <div className="absolute top-5 right-5 z-20">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 350, damping: 28 }}
        className="relative z-10 w-full max-w-md rounded-3xl liquid-glass p-8 sm:p-10 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/25">
            <Cloud className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              OneDriveList
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Repositorio colaborativo
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
          Ingresa con tu cuenta asignada para acceder a los archivos y documentos del equipo.
        </p>

        <form action={action} className="space-y-4">
          <input type="hidden" name="next" value={nextPath || ""} />
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Usuario
            </label>
            <div className="relative">
              <input
                name="username"
                autoComplete="username"
                required
                maxLength={40}
                autoCapitalize="none"
                spellCheck={false}
                placeholder="ej. edwin"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:bg-zinc-900"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Contraseña
            </label>
            <div className="relative">
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:bg-zinc-900"
              />
            </div>
          </div>

          {state.error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
              className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-600 dark:text-rose-400"
            >
              {state.error}
            </motion.div>
          )}

          <motion.button
            disabled={pending}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white transition-colors disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn size={15} aria-hidden="true" />
            )}
            <span>{pending ? "Verificando credenciales…" : "Iniciar sesión"}</span>
          </motion.button>
        </form>

        <div className="mt-8 pt-5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
          <div className="flex items-center gap-1.5">
            <LockKeyhole size={12} />
            <span>Autenticación local segura</span>
          </div>
          <span>v0.1.0</span>
        </div>
      </motion.div>
    </div>
  );
}
