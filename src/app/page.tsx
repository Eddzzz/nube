// src/app/page.tsx
import { listForUser } from "@/services/scoped-drive";
import { DriveList, Breadcrumbs } from "@/features/drive";
import { getDict } from "@/i18n/server";
import { requireUser } from "@/lib/authToken";
import { permissionsFor } from "@/lib/permissions";
import ErrorState from "@/shared/ui/ErrorState";

export default async function Page() {
  const user = await requireUser();
  try {
    const { value: items } = await listForUser(user);
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumbs path={[]} />
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Archivos compartidos
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            {user.role === "admin"
              ? "Administra los archivos y los accesos del equipo."
              : "Aquí aparecen las carpetas que el administrador te ha asignado."}
          </p>
        </div>
        <DriveList items={items} isAdmin={user.role === "admin"} folderPermissions={permissionsFor(user, "")} />
      </div>
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    const { dict } = await getDict();
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ErrorState
          title={dict["error.title"]}
          details={(dict["error.onedrive"] ?? "Error: {message}").replace("{message}", message)}
          actions={[{ href: "/", label: dict["error.action.home"], variant: "primary" }]}
        />
      </div>
    );
  }
}
