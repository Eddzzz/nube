import { BadRequestError } from "./errors";

export const PERMISSIONS = ["read", "download", "upload", "create", "rename", "delete", "versions", "share"] as const;
export type Permission = typeof PERMISSIONS[number];
export const PERMISSION_LABELS: Record<Permission, string> = {
  read: "Consultar", download: "Descargar", upload: "Subir y reemplazar", create: "Crear carpetas",
  rename: "Renombrar", delete: "Eliminar", versions: "Guardar y restaurar versiones",
  share: "Compartir mediante enlace o QR",
};
export type Grant = { path: string; permissions: Permission[] };
export type Identity = { role: "admin" | "user"; grants: Grant[] };
export type Account = Identity & { id: string; username: string; name: string; active: boolean; createdAt: string };

export function validatePath(value: string): string {
  if (value === "") return value;
  if (value.length > 2000 || value.split("/").some((part) => !part || part.length > 255 ||
    /[<>:"\\|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part) || part === "." || part === ".." ||
    /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part) || part.toLowerCase().startsWith(".onedrivelist-"))) {
    throw new BadRequestError("Ruta de carpeta no válida");
  }
  return value;
}

export function pathFromId(id = ""): string {
  if (!id) return "";
  const value = Buffer.from(id, "base64url").toString("utf8");
  if (!/^[\w-]+$/.test(id) || Buffer.from(value).toString("base64url") !== id) {
    throw new BadRequestError("Identificador de archivo no válido");
  }
  return validatePath(value);
}

export function idFromPath(value: string): string {
  return Buffer.from(validatePath(value)).toString("base64url");
}

// Windows paths are case insensitive; changing an ID's letter case must not bypass a restriction.
const key = (value: string) => value.normalize("NFC").toLowerCase();
export const isWithin = (parent: string, target: string) => !parent || key(target) === key(parent) || key(target).startsWith(key(parent) + "/");

export function permissionsFor(user: Identity | null, target: string): Permission[] {
  if (!user) return [];
  if (user.role === "admin") return [...PERMISSIONS];
  const grant = user.grants.filter((g) => isWithin(g.path, target)).sort((a, b) => b.path.length - a.path.length)[0];
  return grant?.permissions ?? [];
}

export function can(user: Identity | null, permission: Permission, target: string): boolean {
  const permissions = permissionsFor(user, target);
  return permissions.includes("read") && permissions.includes(permission);
}

export function canNavigate(user: Identity | null, target: string): boolean {
  return can(user, "read", target) || Boolean(user?.grants.some((g) => g.permissions.includes("read") && isWithin(target, g.path)));
}

export function hasGrantsWithin(users: Identity[], target: string): boolean {
  return users.some((u) => u.grants.some((g) => isWithin(target, g.path)));
}

export function canContribute(user: Identity): boolean {
  return user.role === "admin" || user.grants.some((g) => g.permissions.includes("read") && (g.permissions.includes("upload") || g.permissions.includes("create")));
}
