import type { NextRequest } from "next/server";
import { assertAdmin } from "@/app/api/onedrive/utils";
import { workspaceStore } from "@/lib/authToken";
import { BadRequestError, toErrorResponse } from "@/lib/errors";
import { idFromPath } from "@/lib/permissions";
import { localDrive } from "@/services/onedrive/repo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const actor = await assertAdmin(req);
    const store = await workspaceStore();
    const [crm, users, audit, usage, project, projects] = await Promise.all([
      store.getCrm(actor), store.crmMembers(actor), store.getAudit(actor), localDrive.usage(), store.getProject(actor), store.listProjects(actor),
    ]);
    return Response.json({ ...crm, projects, users, audit, usage, checks: project.checks, academicTasks: project.tasks });
  } catch (error) { return toErrorResponse(error); }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await assertAdmin(req);
    const body = await req.json();
    if (body?.kind === "project" && typeof body.folderPath === "string" && body.folderPath) {
      const folder = await localDrive.getItem(idFromPath(body.folderPath));
      if (!folder.folder) throw new BadRequestError("La carpeta vinculada al proyecto debe ser una carpeta existente");
    }
    return Response.json(await (await workspaceStore()).mutateCrm(actor, body));
  } catch (error) { return toErrorResponse(error); }
}
