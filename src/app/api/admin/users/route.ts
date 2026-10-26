import type { NextRequest } from "next/server";
import { assertAdmin } from "@/app/api/onedrive/utils";
import { workspaceStore } from "@/lib/authToken";
import { BadRequestError, toErrorResponse } from "@/lib/errors";
import { idFromPath, pathFromId } from "@/lib/permissions";
import { localDrive } from "@/services/onedrive/repo";

async function validateFolders(body: Record<string, unknown>) {
  if (!Array.isArray(body.grants)) return;
  for (const grant of body.grants) {
    if (!grant || typeof grant.path !== "string") throw new BadRequestError("Permiso de carpeta no válido");
    if (grant.path && !(await localDrive.getItem(idFromPath(grant.path))).folder) throw new BadRequestError("Asigna permisos a carpetas, no a archivos");
  }
}

export async function GET(req: NextRequest) {
  try {
    const actor = await assertAdmin(req);
    const store = await workspaceStore();
    const folders = (await localDrive.searchItems("")).value.filter((i) => i.folder).map((i) => ({ path: pathFromId(i.id), name: i.name }));
    return Response.json({ users: await store.listUsers(actor), folders, bootstrapUsername: process.env.ADMIN_USERNAME || "admin", audit: await store.getAudit(actor) });
  } catch (error) { return toErrorResponse(error); }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await assertAdmin(req);
    const body = await req.json();
    if (!body || typeof body !== "object") throw new BadRequestError();
    await validateFolders(body);
    const user = await (await workspaceStore()).createUser(actor, body);
    return Response.json(user, { status: 201 });
  } catch (error) { return toErrorResponse(error); }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await assertAdmin(req);
    const body = await req.json();
    if (!body || typeof body !== "object" || typeof body.id !== "string") throw new BadRequestError();
    const { id, ...input } = body;
    await validateFolders(input);
    return Response.json(await (await workspaceStore()).updateUser(actor, id, input));
  } catch (error) { return toErrorResponse(error); }
}
