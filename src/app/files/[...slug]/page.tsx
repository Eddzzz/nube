// src/app/files/[...slug]/page.tsx
import { listForUser } from "@/services/scoped-drive";
import { DriveList, Breadcrumbs, generateBreadcrumbs } from "@/features/drive";
import { getDict } from "@/i18n/server";
import { requireUser } from "@/lib/authToken";
import { idFromPath, pathFromId, permissionsFor } from "@/lib/permissions";
import ErrorState from "@/shared/ui/ErrorState";

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug: requested = [] } = await params;
  const itemId = requested.at(-1);
  const user = await requireUser();

  try {
    const parts = pathFromId(itemId).split("/").filter(Boolean);
    const slug = parts.map((_, i) => idFromPath(parts.slice(0, i + 1).join("/")));
    const { value: items } = await listForUser(user, itemId);
    const { dict } = await getDict();
    const breadcrumbPath = await generateBreadcrumbs(slug, dict["breadcrumbs.unknown"]);
    const currentFolder = breadcrumbPath[breadcrumbPath.length - 1];

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumbs path={breadcrumbPath} />
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {currentFolder?.name ?? dict["page.files.title"]}
          </h1>
        </div>
        <DriveList
          items={items}
          basePathSegments={slug}
          isAdmin={user.role === "admin"}
          folderPermissions={permissionsFor(user, pathFromId(itemId))}
        />
      </div>
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ErrorState
          title="No se pudo abrir la carpeta"
          details={message}
          actions={[{ href: "/", label: "Volver al inicio", variant: "primary" }]}
        />
      </div>
    );
  }
}
