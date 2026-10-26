import { privateDataDirectory } from "./private-data";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppError, ForbiddenError } from "./errors";
import { createWorkspaceStore } from "../services/workspace-store";
import type { Account, Permission } from "./permissions";
import { can, pathFromId } from "./permissions";

export const SESSION_COOKIE = "onelist-session";
export async function workspaceStore() {
  return createWorkspaceStore(await privateDataDirectory(), {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || process.env.admin_password || undefined,
  });
}

export async function currentUser(): Promise<Account | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return (await workspaceStore()).getSession(token);
}

export async function requireUser(): Promise<Account> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function apiUser(req: { cookies: { get(name: string): { value: string } | undefined } }): Promise<Account> {
  const user = await (await workspaceStore()).getSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) throw new AppError("Inicia sesión para continuar", 401);
  return user;
}

export function assertPermission(user: Account, action: Permission, itemId = "") {
  if (!can(user, action, pathFromId(itemId))) throw new ForbiddenError("No tienes permiso para esta operación en la carpeta seleccionada");
}

export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const url = new URL(req.url);
  const host = req.headers.get("host") || url.host;
  if (!origin || new URL(origin).origin !== url.protocol + "//" + host) throw new ForbiddenError("Origen de la solicitud no permitido");
}
