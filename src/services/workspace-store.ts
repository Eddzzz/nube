import * as fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { withDirectoryLock } from "./file-lock";
import { z } from "zod";
import { AppError, BadRequestError, ForbiddenError, NotFoundError } from "../lib/errors";
import { can, canContribute, pathFromId, PERMISSIONS, validatePath, type Account, type Grant } from "../lib/permissions";

const scrypt = promisify(scryptCallback);
export const SESSION_SECONDS = 12 * 60 * 60;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
type StoredUser = Account & { passwordHash: string };
type Session = { userId: string; expires: number; bootstrapVersion?: string };
export type Task = { id: string; title: string; assignee: string; due: string; status: "pending" | "progress" | "completed"; evidence: string; weight?: number };
export type Check = { id: string; title: string; expected: string; status: "pending" | "failed" | "passed"; procedure: string; observed: string; evidence: string; owner: string; updatedAt: string };
export type Audit = { id: string; at: string; actor: string; action: string; target: string };
export type CrmPriority = "low" | "normal" | "high";
export type CrmProject = { id: string; name: string; description: string; memberIds: string[]; folderPath: string; status: "active" | "archived"; createdAt: string; updatedAt: string; ownerId?: string; access?: { userId: string; role: "reader" | "editor" }[] };
export type FolderProjectView = Pick<CrmProject, "id" | "name" | "description" | "folderPath" | "status"> & { ownerId: string; canManage: boolean; role: "owner" | "reader" | "editor" | "admin"; members: { userId: string; name: string; username: string; role: "reader" | "editor" }[] };
export type MyProject = Omit<CrmProject, "memberIds">;
export type CrmJob = { id: string; title: string; description: string; assigneeId: string; projectId: string; due: string; status: "planned" | "active" | "review" | "completed" | "cancelled"; priority: CrmPriority; createdAt: string; updatedAt: string };
export type CrmTodo = { id: string; title: string; jobId: string; assigneeId: string; projectId: string; due: string; status: "pending" | "progress" | "completed"; priority: CrmPriority; createdAt: string; updatedAt: string };
export type ShareLink = { id: string; itemId: string; itemName: string; createdBy: string; createdAt: string; expiresAt: string; requiresAuth: boolean; accessCount: number };
type Data = { version: 1; users: StoredUser[]; sessions: Record<string, Session>; attempts: Record<string, { count: number; until: number }>; tasks: Task[]; checks: Check[]; audit: Audit[]; jobs: CrmJob[]; todos: CrmTodo[]; projects: CrmProject[]; shareLinks: ShareLink[] };

function initialData(): Data {
  const checks = [
    ["Organización", "Cinco subcarpetas y al menos diez archivos propios clasificados. E01-E02."],
    ["Permisos", "Integrantes editan las carpetas asignadas y el revisor consulta sin editar. E03."],
    ["Aportes del equipo", "Dos participantes aportan secuencialmente al mismo archivo; se conserva su historial local. E04."],
    ["Tareas y presentación", "Tareas con responsables y fechas, y presentación de cinco diapositivas cargada. E05."],
    ["Segundo dispositivo", "Archivo actual abierto desde otro dispositivo autorizado de la red. E06."],
    ["Versiones", "El archivo de prueba vuelve a Estado inicial mediante una versión local. E07."],
    ["Papelera", "Archivo de prueba recuperado y abierto en su ubicación original. E08."],
    ["Cierre y respaldo", "Entrega descargada fuera de OneDrive y permiso temporal revocado y comprobado. E09."],
  ].map(([title, expected], i): Check => ({ id: `P0${i + 1}`, title, expected, status: "pending", procedure: "", observed: "", evidence: "", owner: "", updatedAt: "" }));
  const tasks: Task[] = [
    ["A1 Consulta y delimitación", "2026-10-24", 10], ["A2 Cuentas y organización", "2026-10-28", 15],
    ["A3 Archivos y permisos", "2026-11-02", 20], ["A4 Aportes y documentos del equipo", "2026-11-07", 20],
    ["A5 Segundo dispositivo y evidencias", "2026-11-12", 10], ["A6 Recuperación y correcciones", "", 10],
    ["A7 Copia final y revisión de accesos", "", 10], ["A8 Demostración y entrega final", "", 5],
  ].map(([title, due, weight], i) => ({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, title: String(title), due: String(due), weight: Number(weight), assignee: "", status: "pending", evidence: "" }));
  return { version: 1, users: [], sessions: {}, attempts: {}, tasks, checks, audit: [], jobs: [], todos: [], projects: [], shareLinks: [] };
}

const publicUser = (user: StoredUser): Account => ({ id: user.id, username: user.username, name: user.name, role: user.role, grants: user.grants, active: user.active, createdAt: user.createdAt });
const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,39}$/, "Usuario: de 3 a 40 letras, números, puntos, guiones o guiones bajos");
const passwordSchema = z.string().min(12, "La contraseña debe tener al menos 12 caracteres").max(128, "La contraseña admite hasta 128 caracteres");
const grantsSchema = z.array(z.object({ path: z.string().max(2000), permissions: z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length) })).max(100).transform((grants) => {
  const seen = new Set<string>();
  for (const g of grants) {
    validatePath(g.path);
    const normalized = g.path.normalize("NFC").toLowerCase();
    if (seen.has(normalized)) throw new BadRequestError("Hay carpetas repetidas en los permisos");
    seen.add(normalized);
    if (g.permissions.length && !g.permissions.includes("read")) throw new BadRequestError("Los permisos de una carpeta requieren Consultar");
  }
  return grants as Grant[];
});
const accountSchema = z.object({ username: usernameSchema, name: z.string().trim().min(1).max(100), password: passwordSchema, role: z.enum(["admin", "user"]), grants: grantsSchema.default([]) });
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new BadRequestError(result.error.issues.map((i) => i.message).join(". "));
  return result.data;
}
async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return salt + ":" + derived.toString("hex");
}
async function verifyPassword(password: string, encoded: string) {
  const [salt, expected] = encoded.split(":");
  const actual = await scrypt(password, salt, 64) as Buffer;
  const wanted = Buffer.from(expected, "hex");
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}
function assertAdmin(actor: Account) {
  if (actor.role !== "admin" || !actor.active) throw new ForbiddenError("Se requieren permisos de administrador");
}
function record(data: Data, actor: Account, action: string, target: string) {
  data.audit.unshift({ id: randomUUID(), at: new Date().toISOString(), actor: actor.username, action, target });
  data.audit = data.audit.slice(0, 2000);
}

const crmDate = z.string().refine((value) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "La fecha debe ser una fecha válida en formato AAAA-MM-DD");
const crmFields = {
  id: z.string().uuid().optional(), title: z.string().trim().min(1, "Escribe un título").max(200),
  assigneeId: z.string().max(100).default(""), due: crmDate.default(""), priority: z.enum(["low", "normal", "high"]).default("normal"),
  projectId: z.string().max(100).default(""),
};
const crmMutationSchema = z.discriminatedUnion("kind", [
  z.object({ ...crmFields, kind: z.literal("job"), description: z.string().trim().max(4000).default(""), status: z.enum(["planned", "active", "review", "completed", "cancelled"]) }).strict(),
  z.object({ ...crmFields, kind: z.literal("todo"), jobId: z.string().max(100).default(""), status: z.enum(["pending", "progress", "completed"]) }).strict(),
  z.object({ kind: z.literal("project"), id: z.string().uuid().optional(), name: z.string().trim().min(1, "Escribe el nombre del proyecto").max(200),
    description: z.string().trim().max(4000).default(""), memberIds: z.array(z.string().min(1).max(100)).max(200).refine((ids) => new Set(ids).size === ids.length, "Hay integrantes repetidos"),
    folderPath: z.string().max(2000).transform(validatePath).default(""), status: z.enum(["active", "archived"]) }).strict(),
]);
const myWorkMutationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("job"), id: z.string().uuid(), status: z.enum(["planned", "active", "review", "completed"]) }).strict(),
  z.object({ kind: z.literal("todo"), id: z.string().uuid(), status: z.enum(["pending", "progress", "completed"]) }).strict(),
]);

export function createWorkspaceStore(directory: string, bootstrap: { username: string; password?: string }) {
  const filename = path.join(directory, "workspace.json");
  const lock = path.join(directory, ".write-lock");
  const bootstrapUser: Account = { id: "bootstrap", username: bootstrap.username.toLowerCase(), name: "Administrador principal", role: "admin", active: true, grants: [], createdAt: "" };
  async function read(): Promise<Data> {
    try {
      const data = JSON.parse(await fs.readFile(filename, "utf8")) as Data;
      if (data.version !== 1 || !Array.isArray(data.users) || !Array.isArray(data.checks)) throw new Error("Almacén de usuarios no válido");
      // Existing repositories predate the CRM; migrate only missing collections.
      data.jobs ??= [];
      data.todos ??= [];
      data.projects ??= [];
      data.shareLinks ??= [];
      if (!Array.isArray(data.jobs) || !Array.isArray(data.todos) || !Array.isArray(data.projects)) throw new Error("Almacén del CRM no válido");
      for (const job of data.jobs) job.projectId ??= "";
      for (const todo of data.todos) todo.projectId ??= data.jobs.find((job) => job.id === todo.jobId)?.projectId || "";
      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return initialData();
      throw error;
    }
  }
  async function mutate<T>(operation: (data: Data) => Promise<T> | T): Promise<T> {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    return withDirectoryLock(lock, async () => {
    const temporary = filename + "." + randomUUID() + ".tmp";
    try {
      const data = await read();
      const result = await operation(data);
      await fs.writeFile(temporary, JSON.stringify(data), { mode: 0o600, flag: "wx" });
      await fs.rename(temporary, filename);
      return result;
    } finally {
      await fs.unlink(temporary).catch(() => {});
    }
    });
  }
  function prune(data: Data) {
    for (const [id, session] of Object.entries(data.sessions)) if (session.expires <= Date.now()) delete data.sessions[id];
    for (const [id, attempt] of Object.entries(data.attempts)) if (attempt.until <= Date.now()) delete data.attempts[id];
  }
  async function authenticate(username: string, password: string, clientKey: string) {
    if (typeof password !== "string" || password.length > 128 || typeof username !== "string" || username.length > 100) throw new BadRequestError("Credenciales incorrectas");
    username = username.trim().toLowerCase();
    const result = await mutate(async (data) => {
      prune(data);
      const attemptKey = hash(clientKey + ":" + username);
      const attempt = data.attempts[attemptKey];
      if (attempt && attempt.count >= 8) return { error: "Demasiados intentos. Inténtalo de nuevo en 15 minutos.", status: 429 };
      const stored = data.users.find((u) => u.username === username);
      let user: Account | undefined;
      if (bootstrap.password && username === bootstrapUser.username) {
        const actual = Buffer.from(hash(password));
        if (timingSafeEqual(actual, Buffer.from(hash(bootstrap.password)))) user = bootstrapUser;
      } else if (stored?.active && await verifyPassword(password, stored.passwordHash)) user = publicUser(stored);
      // Give unknown accounts the same expensive password work as existing ones.
      else if (!stored?.active) await scrypt(password, "onelist-invalid-account", 64);
      if (!user) {
        data.attempts[attemptKey] = { count: (attempt?.count ?? 0) + 1, until: attempt?.until ?? Date.now() + 15 * 60000 };
        return { error: "Credenciales incorrectas", status: 401 };
      }
      delete data.attempts[attemptKey];
      const token = randomBytes(32).toString("base64url");
      data.sessions[hash(token)] = { userId: user.id, expires: Date.now() + SESSION_SECONDS * 1000,
        ...(user.id === "bootstrap" ? { bootstrapVersion: hash(bootstrap.password!) } : {}) };
      record(data, user, "Inicio de sesión", user.username);
      return { token, user };
    });
    if ("error" in result) throw new AppError(result.error!, result.status!);
    return result;
  }
  async function getSession(token?: string): Promise<Account | null> {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const data = await read();
    const session = data.sessions[hash(token)];
    if (!session || session.expires <= Date.now()) return null;
    if (session.userId === "bootstrap") return bootstrap.password && session.bootstrapVersion === hash(bootstrap.password) ? bootstrapUser : null;
    const user = data.users.find((u) => u.id === session.userId && u.active);
    return user ? effectiveAccount(data, publicUser(user)) : null;
  }
  async function listUsers(actor: Account) {
    assertAdmin(actor);
    return (await read()).users.map(publicUser);
  }
  async function createUser(actor: Account, input: unknown) {
    assertAdmin(actor);
    const value = parse(accountSchema, input);
    const encoded = await passwordHash(value.password);
    return mutate((data) => {
      if (value.username === bootstrapUser.username || data.users.some((u) => u.username === value.username)) throw new BadRequestError("Ya existe ese nombre de usuario");
      const user: StoredUser = { id: randomUUID(), username: value.username, name: value.name, role: value.role, grants: value.grants,
        active: true, createdAt: new Date().toISOString(), passwordHash: encoded };
      data.users.push(user);
      record(data, actor, "Usuario creado", user.username);
      return publicUser(user);
    });
  }
  async function updateUser(actor: Account, id: string, input: unknown) {
    assertAdmin(actor);
    const value = parse(z.object({ name: z.string().trim().min(1).max(100).optional(), role: z.enum(["admin", "user"]).optional(),
      grants: grantsSchema.optional(), active: z.boolean().optional(), password: passwordSchema.optional(), revokeSessions: z.boolean().optional() }).strict(), input);
    if (actor.id === id && (value.active === false || value.role === "user")) throw new BadRequestError("No puedes retirar tu propio acceso de administrador");
    const encoded = value.password ? await passwordHash(value.password) : undefined;
    return mutate((data) => {
      const user = data.users.find((u) => u.id === id);
      if (!user) throw new NotFoundError("Usuario no encontrado");
      const roleChanged = value.role !== undefined && value.role !== user.role;
      if (!bootstrap.password && user.role === "admin" && user.active && (value.role === "user" || value.active === false) &&
        data.users.filter((u) => u.role === "admin" && u.active).length <= 1) throw new BadRequestError("Debe quedar un administrador activo");
      if (value.name !== undefined) user.name = value.name;
      if (value.role !== undefined) user.role = value.role;
      if (value.grants !== undefined) user.grants = value.grants;
      if (value.active !== undefined) user.active = value.active;
      if (encoded) user.passwordHash = encoded;
      if (encoded || value.active === false || value.revokeSessions || roleChanged) {
        for (const [key, session] of Object.entries(data.sessions)) if (session.userId === id) delete data.sessions[key];
      }
      record(data, actor, encoded ? "Contraseña restablecida y sesiones revocadas" : value.revokeSessions ? "Sesiones revocadas" : "Usuario y permisos actualizados", user.username);
      return publicUser(user);
    });
  }
  async function logout(token?: string) {
    if (token) await mutate((data) => { delete data.sessions[hash(token)]; });
  }
  async function audit(actor: Account, action: string, target: string) {
    await mutate((data) => { record(data, actor, action, target); });
  }
  async function getAudit(actor: Account) {
    assertAdmin(actor);
    return (await read()).audit;
  }
  async function getProject(actor: Account) {
    if (!actor.active) throw new ForbiddenError();
    const data = await read();
    return { tasks: data.tasks, checks: data.checks };
  }
  async function updateProject(actor: Account, input: unknown) {
    if (!canContribute(actor)) throw new ForbiddenError("No tienes permiso para editar el proyecto");
    const value = parse(z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("task"), id: z.string().uuid().optional(), title: z.string().trim().min(1).max(200), assignee: z.string().max(100).default(""),
        due: z.string().refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), "Fecha no válida").default(""),
        status: z.enum(["pending", "progress", "completed"]), evidence: z.string().max(2000).default("") }),
      z.object({ kind: z.literal("check"), id: z.string().regex(/^P0[1-8]$/), status: z.enum(["pending", "failed", "passed"]),
        procedure: z.string().max(4000).default(""), observed: z.string().max(4000), evidence: z.string().max(2000), owner: z.string().max(100).default("") }),
    ]), input);
    return mutate((data) => {
      if (value.kind === "task") {
        if (value.status === "completed" && !value.evidence.trim()) throw new BadRequestError("Registra una evidencia para completar la actividad");
        const fields = { title: value.title, assignee: value.assignee, due: value.due, status: value.status, evidence: value.evidence };
        const existing = value.id ? data.tasks.find((task) => task.id === value.id) : undefined;
        if (value.id && !existing) throw new NotFoundError("Tarea no encontrada");
        if (existing) Object.assign(existing, fields);
        else data.tasks.unshift({ ...fields, id: randomUUID() });
        record(data, actor, "Tarea actualizada", value.title);
      } else {
        if (value.status !== "pending" && (!value.observed.trim() || !value.evidence.trim())) throw new BadRequestError("Registra el resultado observado y la evidencia antes de verificar la prueba");
        const check = data.checks.find((c) => c.id === value.id)!;
        Object.assign(check, { status: value.status, procedure: value.procedure, observed: value.observed, evidence: value.evidence, owner: value.owner || actor.username, updatedAt: new Date().toISOString() });
        record(data, actor, "Prueba documentada", value.id);
      }
      return { tasks: data.tasks, checks: data.checks };
    });
  }
  async function grantHolders() {
    const data = await read();
    return [...data.users.map((u) => ({ role: u.role, grants: u.grants })), ...data.projects.filter((project) => project.folderPath).map((project) => ({ role: "user" as const, grants: [{ path: project.folderPath, permissions: ["read" as const] }] }))];
  }
  async function getCrm(actor: Account) {
    assertAdmin(actor);
    const data = await read();
    return { jobs: data.jobs, todos: data.todos };
  }
  async function crmMembers(actor: Account): Promise<Account[]> {
    assertAdmin(actor);
    return [...(bootstrap.password ? [bootstrapUser] : []), ...(await read()).users.map(publicUser)];
  }
  async function listProjects(actor: Account) {
    assertAdmin(actor);
    return (await read()).projects;
  }
  async function mutateCrm(actor: Account, input: unknown) {
    assertAdmin(actor);
    const value = parse(crmMutationSchema, input);
    return mutate((data) => {
      const now = new Date().toISOString();
      if (value.kind === "project") {
        const existing = value.id ? data.projects.find((project) => project.id === value.id) : undefined;
        if (value.id && !existing) throw new NotFoundError("Proyecto no encontrado");
        for (const id of value.memberIds) {
          if (id === bootstrapUser.id && bootstrap.password) continue;
          if (!data.users.some((user) => user.id === id && (user.active || existing?.memberIds.includes(id)))) throw new BadRequestError("Los integrantes nuevos deben ser usuarios activos");
        }
        const fields = { name: value.name, description: value.description, memberIds: value.memberIds, folderPath: value.folderPath, status: value.status, updatedAt: now };
        if (existing) Object.assign(existing, fields);
        else data.projects.unshift({ ...fields, id: randomUUID(), createdAt: now });
        record(data, actor, existing ? "Proyecto actualizado" : "Proyecto creado", value.name);
        return { projects: data.projects, jobs: data.jobs, todos: data.todos };
      }
      const previous = value.id ? (value.kind === "job" ? data.jobs : data.todos).find((item) => item.id === value.id) : undefined;
      if (value.id && !previous) throw new NotFoundError(value.kind === "job" ? "Trabajo no encontrado" : "Pendiente no encontrado");
      const retainsAssignee = previous?.assigneeId === value.assigneeId;
      if (value.assigneeId && !(value.assigneeId === bootstrapUser.id && bootstrap.password) &&
        !data.users.some((user) => user.id === value.assigneeId && (user.active || retainsAssignee))) {
        throw new BadRequestError("El responsable debe ser un usuario activo");
      }
      const linkedJob = value.kind === "todo" && value.jobId ? data.jobs.find((job) => job.id === value.jobId) : undefined;
      if (value.kind === "todo" && value.jobId && !linkedJob) throw new BadRequestError("El trabajo asociado no existe");
      if (linkedJob && value.projectId && value.projectId !== linkedJob.projectId) throw new BadRequestError("El pendiente y su trabajo deben pertenecer al mismo proyecto");
      const projectId = linkedJob?.projectId || value.projectId;
      const project = projectId ? data.projects.find((item) => item.id === projectId) : undefined;
      if (projectId && !project) throw new BadRequestError("El proyecto seleccionado no existe");
      if (project && value.assigneeId && !project.memberIds.includes(value.assigneeId) && !(retainsAssignee && previous.projectId === projectId)) throw new BadRequestError("El responsable debe ser integrante del proyecto");
      if (value.kind === "job" && previous && previous.projectId !== projectId && data.todos.some((todo) => todo.jobId === previous.id)) throw new BadRequestError("Desvincula las tareas antes de cambiar el proyecto del trabajo");
      if (value.kind === "job") {
        const existing = value.id ? data.jobs.find((job) => job.id === value.id) : undefined;
        if (value.id && !existing) throw new NotFoundError("Trabajo no encontrado");
        const fields = { title: value.title, description: value.description, assigneeId: value.assigneeId, projectId, due: value.due, status: value.status, priority: value.priority, updatedAt: now };
        if (existing) Object.assign(existing, fields);
        else data.jobs.unshift({ ...fields, id: randomUUID(), createdAt: now });
        record(data, actor, existing ? "Trabajo actualizado" : "Trabajo creado", value.title);
      } else {
        if (value.jobId && !data.jobs.some((job) => job.id === value.jobId)) throw new BadRequestError("El trabajo asociado no existe");
        const existing = value.id ? data.todos.find((todo) => todo.id === value.id) : undefined;
        if (value.id && !existing) throw new NotFoundError("Pendiente no encontrado");
        const fields = { title: value.title, jobId: value.jobId, assigneeId: value.assigneeId, projectId, due: value.due, status: value.status, priority: value.priority, updatedAt: now };
        if (existing) Object.assign(existing, fields);
        else data.todos.unshift({ ...fields, id: randomUUID(), createdAt: now });
        record(data, actor, existing ? "Pendiente actualizado" : "Pendiente creado", value.title);
      }
      return { projects: data.projects, jobs: data.jobs, todos: data.todos };
    });
  }
  function assertActiveMember(data: Data, actor: Account) {
    if (!actor.active || !(actor.id === bootstrapUser.id && bootstrap.password) && !data.users.some((user) => user.id === actor.id && user.active)) throw new ForbiddenError("La cuenta ya no está activa. Inicia sesión de nuevo.");
  }
  function currentAccount(data: Data, actor: Account): Account {
    const current = actor.id === bootstrapUser.id && bootstrap.password ? bootstrapUser : data.users.find((user) => user.id === actor.id && user.active);
    if (!current) throw new ForbiddenError("La cuenta ya no está activa");
    return current;
  }
  function effectiveAccount(data: Data, actor: Account): Account {
    if (actor.role === "admin") return actor;
    const grants = actor.grants.map((grant) => ({ ...grant, permissions: [...grant.permissions] }));
    for (const project of data.projects) {
      if (!project.ownerId || !project.folderPath) continue;
      const role = project.ownerId === actor.id ? "editor" : project.access?.find((member) => member.userId === actor.id)?.role;
      if (!role || grants.some((grant) => grant.path.normalize("NFC").toLowerCase() === project.folderPath.normalize("NFC").toLowerCase())) continue;
      grants.push({ path: project.folderPath, permissions: project.status === "archived" || role === "reader" ? ["read", "download"] : project.ownerId === actor.id ? [...PERMISSIONS] : PERMISSIONS.filter((permission) => permission !== "share") });
    }
    return { ...actor, grants };
  }
  function folderView(data: Data, actor: Account, project: CrmProject): FolderProjectView | null {
    const ownerId = project.ownerId || bootstrapUser.id;
    const membership = project.access?.find((member) => member.userId === actor.id);
    const role = actor.id === ownerId ? "owner" : actor.role === "admin" ? "admin" : membership?.role || (project.memberIds.includes(actor.id) ? "reader" : null);
    if (!role) return null;
    const canManage = role === "owner" || role === "admin";
    const members: FolderProjectView["members"] = [];
    if (canManage) for (const entry of [{ userId: ownerId, role: "editor" as const }, ...(project.access || project.memberIds.filter((id) => id !== ownerId).map((userId) => ({ userId, role: "reader" as const })))]) {
      const person = entry.userId === bootstrapUser.id ? bootstrapUser : data.users.find((user) => user.id === entry.userId);
      if (person && !members.some((member) => member.userId === entry.userId)) members.push({ userId: person.id, name: person.name, username: person.username, role: entry.role });
    }
    return { id: project.id, name: project.name, description: project.description, folderPath: project.folderPath, status: project.status, ownerId, role, canManage, members };
  }
  async function listFolderProjects(actor: Account) {
    const data = await read(); const current = currentAccount(data, actor);
    return data.projects.map((project) => folderView(data, current, project)).filter((project): project is FolderProjectView => project !== null);
  }
  async function folderProjectPeople(actor: Account) {
    const data = await read(); currentAccount(data, actor);
    return [...(bootstrap.password ? [bootstrapUser] : []), ...data.users.filter((user) => user.active)].map(({ id, name, username }) => ({ id, name, username }));
  }
  async function createFolderProject(actor: Account, input: unknown) {
    const value = parse(z.object({ name: z.string().trim().min(1).max(200), description: z.string().trim().max(4000).default(""), folderPath: z.string().min(1).max(2000).transform(validatePath) }).strict(), input);
    return mutate((data) => {
      const current = currentAccount(data, actor);
      if (data.projects.some((project) => project.folderPath.toLowerCase() === value.folderPath.toLowerCase())) throw new BadRequestError("La carpeta ya pertenece a un proyecto");
      const now = new Date().toISOString();
      const project: CrmProject = { ...value, id: randomUUID(), ownerId: current.id, memberIds: [current.id], access: [], status: "active", createdAt: now, updatedAt: now };
      data.projects.unshift(project); record(data, current, "Proyecto creado", value.folderPath);
      return folderView(data, current, project)!;
    });
  }
  async function updateFolderProject(actor: Account, input: unknown) {
    const value = parse(z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(200).optional(), description: z.string().trim().max(4000).optional(), status: z.enum(["active", "archived"]).optional(), access: z.array(z.object({ userId: z.string().min(1).max(100), role: z.enum(["reader", "editor"]) }).strict()).max(200).optional() }).strict(), input);
    return mutate((data) => {
      const current = currentAccount(data, actor); const project = data.projects.find((item) => item.id === value.id);
      if (!project) throw new NotFoundError("Proyecto no encontrado");
      if (current.role !== "admin" && current.id !== (project.ownerId || bootstrapUser.id)) throw new ForbiddenError("Solo el propietario o administrador puede gestionar el proyecto");
      if (value.access) {
        const ownerId = project.ownerId || bootstrapUser.id;
        const access = value.access.filter((entry) => entry.userId !== ownerId);
        if (new Set(access.map((entry) => entry.userId)).size !== access.length) throw new BadRequestError("Hay integrantes repetidos");
        for (const entry of access) if (!(entry.userId === bootstrapUser.id && bootstrap.password) && !data.users.some((user) => user.id === entry.userId && user.active)) throw new BadRequestError("Selecciona usuarios activos");
        project.ownerId = ownerId; project.access = access; project.memberIds = [ownerId, ...access.map((entry) => entry.userId)];
      }
      if (value.name !== undefined) project.name = value.name;
      if (value.description !== undefined) project.description = value.description;
      if (value.status !== undefined) project.status = value.status;
      project.updatedAt = new Date().toISOString(); record(data, current, "Proyecto actualizado", project.name);
      return folderView(data, current, project)!;
    });
  }
  function projectVisible(data: Data, actor: Account, projectId: string) {
    return !projectId || data.projects.some((project) => project.id === projectId && project.memberIds.includes(actor.id));
  }
  function myWork(data: Data, actor: Account) {
    assertActiveMember(data, actor);
    const projects: MyProject[] = data.projects.filter((project) => project.memberIds.includes(actor.id)).map((project) => ({ id: project.id, name: project.name, description: project.description, folderPath: project.folderPath, status: project.status, createdAt: project.createdAt, updatedAt: project.updatedAt }));
    return { projects, jobs: data.jobs.filter((job) => job.assigneeId === actor.id && projectVisible(data, actor, job.projectId)),
      todos: data.todos.filter((todo) => todo.assigneeId === actor.id && projectVisible(data, actor, todo.projectId)) };
  }
  async function getMyWork(actor: Account) { return myWork(await read(), actor); }
  async function updateMyWork(actor: Account, input: unknown) {
    const value = parse(myWorkMutationSchema, input);
    return mutate((data) => {
      assertActiveMember(data, actor);
      const item = value.kind === "job" ? data.jobs.find((job) => job.id === value.id) : data.todos.find((todo) => todo.id === value.id);
      if (!item || item.assigneeId !== actor.id || !projectVisible(data, actor, item.projectId)) throw new ForbiddenError("No tienes permiso para cambiar un trabajo que no tienes asignado");
      const project = data.projects.find((project) => project.id === item.projectId);
      if (project?.status === "archived") throw new ForbiddenError("El proyecto está archivado; consulta al administrador antes de actualizarlo");
      if (value.kind === "job" && item.status === "cancelled") throw new ForbiddenError("El trabajo está cancelado; solo el administrador puede reabrirlo");
      if (value.kind === "job") (item as CrmJob).status = value.status;
      else (item as CrmTodo).status = value.status;
      item.updatedAt = new Date().toISOString();
      record(data, actor, value.kind === "job" ? "Estado de trabajo actualizado por responsable" : "Estado de pendiente actualizado por responsable", item.title);
      return myWork(data, actor);
    });
  }
  async function createShareLink(actor: Account, input: { itemId: string; itemName: string; expiresAt?: string; requiresAuth: boolean }): Promise<ShareLink> {
    if (!actor.active) throw new ForbiddenError("Usuario inactivo");
    return mutate((data) => {
      data.shareLinks ??= [];
      const id = randomBytes(24).toString("base64url");
      const link: ShareLink = {
        id,
        itemId: input.itemId,
        itemName: input.itemName,
        createdBy: actor.username,
        createdAt: new Date().toISOString(),
        expiresAt: input.expiresAt || "",
        requiresAuth: Boolean(input.requiresAuth),
        accessCount: 0,
      };
      data.shareLinks.unshift(link);
      if (data.shareLinks.length > 1000) data.shareLinks = data.shareLinks.slice(0, 1000);
      record(data, actor, "Enlace para compartir creado", input.itemName);
      return link;
    });
  }
  async function getShareLink(id: string): Promise<ShareLink | null> {
    if (!id || !/^[A-Za-z0-9_-]{20,64}$/.test(id)) return null;
    const data = await read();
    data.shareLinks ??= [];
    const link = data.shareLinks.find((l) => l.id === id);
    if (!link) return null;
    if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) {
      return null;
    }
    const creator = bootstrap.password && link.createdBy === bootstrapUser.username ? bootstrapUser : data.users.find((user) => user.username === link.createdBy && user.active);
    if (!creator) return null;
    try {
      if (!can(effectiveAccount(data, creator), "share", pathFromId(link.itemId))) return null;
    } catch { return null; }
    return link;
  }
  async function recordShareAccess(id: string): Promise<void> {
    if (!id) return;
    await mutate((data) => {
      data.shareLinks ??= [];
      const link = data.shareLinks.find((l) => l.id === id);
      if (link) {
        link.accessCount = (link.accessCount || 0) + 1;
      }
    });
  }
  async function listShareLinks(actor: Account): Promise<ShareLink[]> {
    assertAdmin(actor);
    const data = await read();
    return data.shareLinks ?? [];
  }
  async function deleteShareLink(actor: Account, id: string): Promise<void> {
    return mutate((data) => {
      data.shareLinks ??= [];
      const index = data.shareLinks.findIndex((l) => l.id === id);
      if (index === -1) throw new NotFoundError("Enlace no encontrado");
      const link = data.shareLinks[index];
      if (actor.role !== "admin" && link.createdBy !== actor.username) {
        throw new ForbiddenError("No tienes permiso para eliminar este enlace");
      }
      data.shareLinks.splice(index, 1);
      record(data, actor, "Enlace para compartir eliminado", link.itemName);
    });
  }
  return { authenticate, getSession, listUsers, createUser, updateUser, logout, audit, getAudit, getProject, updateProject, grantHolders, getCrm, crmMembers, mutateCrm, listProjects, getMyWork, updateMyWork, createShareLink, getShareLink, recordShareAccess, listShareLinks, deleteShareLink, listFolderProjects, folderProjectPeople, createFolderProject, updateFolderProject };
}
