import type { NextRequest } from "next/server";
import { apiUser, workspaceStore } from "@/lib/authToken";
import { idFromPath } from "@/lib/permissions";
import { toErrorResponse } from "@/lib/errors";
import { localDrive } from "@/services/onedrive/repo";
import { uploadPathsFor } from "@/services/personal-uploads";

export async function GET(req: NextRequest) {
  try {
    const user = await apiUser(req);
    const { projects } = await (await workspaceStore()).getMyWork(user);
    const paths = uploadPathsFor(user, projects.filter((project) => project.folderPath).map((project) => project.folderPath));
    const targets: { id: string; path: string; name: string }[] = [];
    for (const folder of paths) {
      const id = idFromPath(folder);
      try {
        if (!folder || (await localDrive.getItem(id)).folder) targets.push({ id, path: folder, name: folder || "Raíz del repositorio" });
      } catch { /* A removed or inaccessible folder is not an upload destination. */ }
    }
    return Response.json({ targets });
  } catch (error) { return toErrorResponse(error); }
}
