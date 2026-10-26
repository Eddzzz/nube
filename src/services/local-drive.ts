import { constants, createReadStream, createWriteStream } from "node:fs";
import * as fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { AppError, BadRequestError, ForbiddenError, NotFoundError } from "../lib/errors";
import type { DriveItemSummary } from "./onedrive/repo";
import { pathFromId, idFromPath, isWithin } from "../lib/permissions";
import { withDirectoryLock } from "./file-lock";

const PRIVATE_PREFIX = ".onedrivelist-";
const MAX_FILE_BYTES = 200 * 1024 * 1024;
const META_NAME = ".onedrivelist-meta.json";
export type RecoveryEntry = { id: string; originalPath: string; name: string; createdAt: string; size: number; folder: boolean; versionIds?: string[] };
const mimeTypes: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".bmp": "image/bmp", ".mp3": "audio/mpeg", ".wav": "audio/wav",
  ".ogg": "audio/ogg", ".flac": "audio/flac", ".m4a": "audio/mp4",
  ".aac": "audio/aac", ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8", ".pdf": "application/pdf",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".ogv": "video/ogg",
};

export function createLocalDrive(configuredRoot: string) {
  async function rootPath() {
    if (!configuredRoot) throw new AppError("Conecta OneDrive desde Administración → Almacenamiento o configura LOCAL_DRIVE_ROOT", 503);
    return fs.realpath(configuredRoot);
  }

  function assertInside(root: string, target: string) {
    const relative = path.relative(root, target);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new ForbiddenError("No se permite salir de la carpeta compartida");
    }
  }

  function validateName(name: string) {
    if (!name || name.length > 255 || /[<>:"/\\|?*\x00-\x1f]/.test(name) ||
        /[. ]$/.test(name) || name === "." || name === ".." ||
        /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name) ||
        name.toLowerCase().startsWith(PRIVATE_PREFIX)) {
      throw new BadRequestError("Nombre de archivo o carpeta no válido");
    }
  }

  async function resolveItem(id?: string) {
    const root = await rootPath();
    if (!id) return root;
    const relative = Buffer.from(id, "base64url").toString("utf8");
    if (!/^[\w-]+$/.test(id) || Buffer.from(relative).toString("base64url") !== id) {
      throw new BadRequestError("Identificador de archivo no válido");
    }
    const segments = relative.split("/");
    segments.forEach(validateName);
    let target = root;
    for (const segment of segments) {
      target = path.join(target, segment);
      assertInside(root, target);
      try {
        const info = await fs.lstat(target);
        if (info.isSymbolicLink()) throw new ForbiddenError("No se permiten enlaces en la carpeta compartida");
        assertInside(root, await fs.realpath(target));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new NotFoundError();
        throw error;
      }
    }
    return target;
  }

  async function summary(target: string): Promise<DriveItemSummary> {
    const root = await rootPath();
    assertInside(root, target);
    const info = await fs.stat(target);
    const relative = path.relative(root, target).split(path.sep).join("/");
    const id = Buffer.from(relative).toString("base64url");
    return {
      id, name: path.basename(target), size: info.isDirectory() ? 0 : info.size,
      lastModifiedDateTime: info.mtime.toISOString(),
      ...(info.isDirectory() ? { folder: {} } : { file: { mimeType: mimeTypes[path.extname(target).toLowerCase()] ?? "application/octet-stream" } }),
    };
  }

  async function listChildren(id?: string) {
    const directory = await resolveItem(id);
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const value = [];
    for (const entry of entries) {
      if (entry.name.toLowerCase().startsWith(PRIVATE_PREFIX) || entry.isSymbolicLink()) continue;
      if (!entry.isDirectory() && !entry.isFile()) continue;
      value.push(await summary(path.join(directory, entry.name)));
    }
    value.sort((a, b) => Number(Boolean(b.folder)) - Number(Boolean(a.folder)) || a.name.localeCompare(b.name, "es"));
    return { value };
  }

  async function parentPath(id?: string) {
    const parent = await resolveItem(id);
    if (!(await fs.stat(parent)).isDirectory()) throw new BadRequestError("El destino debe ser una carpeta");
    return parent;
  }

  function candidate(parent: string, name: string, index: number) {
    if (index === 0) return path.join(parent, name);
    const ext = path.extname(name);
    return path.join(parent, `${name.slice(0, name.length - ext.length)} (${index})${ext}`);
  }

  async function createFolder({ name, parentId, conflictBehavior = "rename" }: {
    name: string; parentId?: string; conflictBehavior?: "fail" | "replace" | "rename";
  }) {
    validateName(name);
    const parent = await parentPath(parentId);
    for (let index = 0; ; index++) {
      const target = candidate(parent, name, index);
      try {
        await fs.mkdir(target);
        return summary(target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        if (conflictBehavior !== "rename") throw new BadRequestError("Ya existe un elemento con ese nombre");
      }
    }
  }

  async function renameDriveItem(id: string, name: string) {
    if (!id) throw new ForbiddenError("No se puede renombrar la carpeta compartida");
    validateName(name);
    const source = await resolveItem(id);
    const target = path.join(path.dirname(source), name);
    if (source === target) return summary(source);
    try {
      await fs.lstat(target);
      throw new BadRequestError("Ya existe un elemento con ese nombre");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await fs.rename(source, target);
    const previous = pathFromId(id);
    const next = pathFromId((await summary(target)).id);
    for (const entry of await recoveryEntries("versions")) {
      if (!isWithin(previous, entry.originalPath)) continue;
      const directory = await recoveryDirectory("versions", entry.id);
      const originalPath = next + entry.originalPath.slice(previous.length);
      const temporary = path.join(directory, "metadata-" + randomUUID() + ".tmp");
      await fs.writeFile(temporary, JSON.stringify({ ...entry, originalPath, name: originalPath.split("/").at(-1) }), { flag: "wx" });
      await fs.rename(temporary, path.join(directory, META_NAME));
    }
    return summary(target);
  }

  async function deleteDriveItem(id: string) {
    if (!id) throw new ForbiddenError("No se puede eliminar la carpeta compartida");
    const source = await resolveItem(id);
    const trash = await privateDirectory("trash");
    const recovery = await fs.mkdtemp(path.join(trash, `${randomUUID()}-`));
    const item = await summary(source);
    const originalPath = pathFromId(id);
    const versionIds = (await recoveryEntries("versions")).filter((entry) => isWithin(originalPath, entry.originalPath)).map((entry) => entry.id);
    try {
      // The trash manifest owns these versions until restoration, even if this path is reused.
      await fs.writeFile(path.join(recovery, META_NAME), JSON.stringify({
        originalPath, name: item.name, createdAt: new Date().toISOString(), size: item.size, folder: Boolean(item.folder), versionIds,
      }), { flag: "wx" });
      await fs.rename(source, path.join(recovery, path.basename(source)));
    } catch (error) {
      await fs.unlink(path.join(recovery, META_NAME)).catch(() => {});
      await fs.rmdir(recovery).catch(() => {});
      throw error;
    }
  }

  async function privateDirectory(kind: "trash" | "versions") {
    const root = await rootPath();
    const target = path.join(root, `${PRIVATE_PREFIX}${kind}`);
    await fs.mkdir(target, { recursive: true });
    if ((await fs.lstat(target)).isSymbolicLink()) throw new ForbiddenError("Carpeta de recuperación no válida");
    assertInside(root, await fs.realpath(target));
    return target;
  }

  async function recoveryDirectory(kind: "trash" | "versions", id: string) {
    if (!/^[a-f0-9-]{36}-[a-zA-Z0-9_-]+$/.test(id)) throw new BadRequestError("Identificador de recuperación no válido");
    const parent = await privateDirectory(kind);
    const target = path.join(parent, id);
    if ((await fs.lstat(target)).isSymbolicLink()) throw new ForbiddenError("Recuperación no válida");
    assertInside(parent, await fs.realpath(target));
    return target;
  }

  async function recoveryMetadata(kind: "trash" | "versions", id: string): Promise<RecoveryEntry> {
    const directory = await recoveryDirectory(kind, id);
    const target = path.join(directory, META_NAME);
    if ((await fs.lstat(target)).isSymbolicLink()) throw new ForbiddenError();
    const entry = JSON.parse(await fs.readFile(target, "utf8")) as RecoveryEntry;
    // Validate disk metadata before it becomes a path for a write operation.
    pathFromId(idFromPath(entry.originalPath));
    validateName(entry.name);
    if (entry.name !== entry.originalPath.split("/").at(-1)) throw new BadRequestError("Metadatos de recuperación no válidos");
    if (entry.versionIds !== undefined && (!Array.isArray(entry.versionIds) || entry.versionIds.some((value) => typeof value !== "string"))) throw new BadRequestError("Historial de recuperación no válido");
    return { ...entry, id };
  }

  async function recoveryEntries(kind: "trash" | "versions"): Promise<RecoveryEntry[]> {
    const directory = await privateDirectory(kind);
    const entries: RecoveryEntry[] = [];
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      try {
        const metadata = await recoveryMetadata(kind, entry.name);
        // Moving the payload commits deletion/restoration; an interrupted manifest alone owns nothing.
        if (kind === "trash") await fs.lstat(path.join(directory, entry.name, metadata.name));
        entries.push(metadata);
      } catch (error) {
        // Older trash entries have no original-path metadata and remain recoverable in Windows.
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    if (kind === "versions") {
      const trash = await recoveryEntries("trash");
      return entries.filter((entry) => !trash.some((deleted) => deleted.versionIds ? deleted.versionIds.includes(entry.id) :
        isWithin(deleted.originalPath, entry.originalPath) && entry.createdAt <= deleted.createdAt))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function listTrash() { return recoveryEntries("trash"); }

  async function restoreTrash(id: string) {
    const metadata = await recoveryMetadata("trash", id);
    const directory = await recoveryDirectory("trash", id);
    const originalParent = metadata.originalPath.split("/").slice(0, -1).join("/");
    const parent = await parentPath(idFromPath(originalParent));
    const target = path.join(parent, metadata.name);
    const source = path.join(directory, metadata.name);
    if ((await fs.lstat(source)).isSymbolicLink()) throw new ForbiddenError();
    try { await fs.lstat(target); throw new BadRequestError("Ya existe un elemento en la ubicación original; renómbralo antes de restaurar"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    await fs.rename(source, target);
    await fs.unlink(path.join(directory, META_NAME));
    await fs.rmdir(directory);
    return summary(target);
  }

  async function listVersions(id: string) {
    await resolveItem(id);
    const originalPath = pathFromId(id);
    return (await recoveryEntries("versions")).filter((entry) => entry.originalPath === originalPath);
  }

  async function saveVersion(id: string) {
    const target = await resolveItem(id);
    const info = await fs.stat(target);
    if (!info.isFile()) throw new BadRequestError("Las versiones se aplican a archivos");
    if (info.size > MAX_FILE_BYTES) throw new BadRequestError("Las versiones admiten archivos de hasta 200 MB");
    const parent = await privateDirectory("versions");
    const directory = await fs.mkdtemp(path.join(parent, `${randomUUID()}-`));
    const entry: RecoveryEntry = { id: path.basename(directory), originalPath: pathFromId(id), name: path.basename(target), createdAt: new Date().toISOString(), size: info.size, folder: false };
    await fs.copyFile(target, path.join(directory, "content"), constants.COPYFILE_EXCL);
    await fs.writeFile(path.join(directory, META_NAME), JSON.stringify(entry), { flag: "wx" });
    return entry;
  }

  function sizeLimiter() {
    let received = 0;
    return new Transform({ transform(chunk, _encoding, callback) {
      received += chunk.length;
      callback(received > MAX_FILE_BYTES ? new BadRequestError("Cada archivo admite hasta 200 MB") : null, chunk);
    } });
  }

  async function replaceContent(id: string, request: Request) {
    const target = await resolveItem(id);
    if (!(await fs.stat(target)).isFile()) throw new BadRequestError("Selecciona un archivo");
    const staging = await fs.mkdtemp(path.join(path.dirname(target), `${PRIVATE_PREFIX}upload-`));
    const temporary = path.join(staging, "content");
    try {
      if (request.body) await pipeline(Readable.fromWeb(request.body as import("node:stream/web").ReadableStream), sizeLimiter(), createWriteStream(temporary, { flags: "wx" }), { signal: request.signal });
      else await fs.writeFile(temporary, "", { flag: "wx" });
      await saveVersion(id);
      // Recheck before replacing so a removed parent/junction cannot redirect this write.
      await resolveItem(id);
      await fs.rename(temporary, target);
      return summary(target);
    } finally {
      assertInside(await rootPath(), staging);
      await fs.rm(staging, { recursive: true, force: true });
    }
  }

  async function restoreVersion(id: string, versionId: string) {
    const metadata = await recoveryMetadata("versions", versionId);
    if (metadata.originalPath !== pathFromId(id)) throw new ForbiddenError("La versión pertenece a otro archivo");
    if (!(await recoveryEntries("versions")).some((entry) => entry.id === versionId)) throw new ForbiddenError("La versión pertenece a un elemento de la papelera");
    const directory = await recoveryDirectory("versions", versionId);
    const content = path.join(directory, "content");
    if ((await fs.lstat(content)).isSymbolicLink()) throw new ForbiddenError();
    const target = await resolveItem(id);
    await saveVersion(id);
    const staging = await fs.mkdtemp(path.join(path.dirname(target), `${PRIVATE_PREFIX}upload-`));
    try {
      await fs.copyFile(content, path.join(staging, "content"), constants.COPYFILE_EXCL);
      await resolveItem(id);
      await fs.rename(path.join(staging, "content"), target);
      return summary(target);
    } finally {
      assertInside(await rootPath(), staging);
      await fs.rm(staging, { recursive: true, force: true });
    }
  }

  async function upload(request: Request, name: string, parentId?: string) {
    validateName(name);
    const parent = await parentPath(parentId);
    const staging = await fs.mkdtemp(path.join(parent, `${PRIVATE_PREFIX}upload-`));
    const temporary = path.join(staging, "content");
    try {
      if (request.body) {
        await pipeline(Readable.fromWeb(request.body as import("node:stream/web").ReadableStream), sizeLimiter(), createWriteStream(temporary, { flags: "wx" }), { signal: request.signal });
      } else {
        await fs.writeFile(temporary, "", { flag: "wx" });
      }
      // Exclusive creation preserves existing files, including when uploads race.
      for (let index = 0; ; index++) {
        const target = candidate(parent, name, index);
        try {
          await fs.copyFile(temporary, target, constants.COPYFILE_EXCL);
          return await summary(target);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        }
      }
    } finally {
      assertInside(await rootPath(), staging);
      await fs.rm(staging, { recursive: true, force: true });
    }
  }

  async function searchItems(query: string) {
    const value = [];
    const pending: (string | undefined)[] = [undefined];
    while (pending.length) {
      const children = await listChildren(pending.pop());
      for (const item of children.value) {
        if (item.name.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es"))) value.push(item);
        if (item.folder) pending.push(item.id);
      }
    }
    return { value };
  }

  async function readText(id: string) {
    const target = await resolveItem(id);
    if ((await fs.stat(target)).size > 5 * 1024 * 1024) throw new BadRequestError("La vista previa de texto admite hasta 5 MB");
    return fs.readFile(target, "utf8");
  }

  async function download(id: string, request: Request) {
    const target = await resolveItem(id);
    const info = await fs.stat(target);
    if (!info.isFile()) throw new BadRequestError("Selecciona un archivo");
    let start = 0;
    let end = info.size - 1;
    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (match && (match[1] || match[2])) {
        start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2]));
        end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
      }
      if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= info.size) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
      }
    }
    const inline = new URL(request.url).searchParams.get("inline") === "1";
    const mime = mimeTypes[path.extname(target).toLowerCase()] ?? "application/octet-stream";
    const browserMedia = mime === "application/pdf" || mime.startsWith("video/") || mime.startsWith("audio/");
    const headers = new Headers({
      "Content-Type": mime,
      "Content-Length": String(Math.max(0, end - start + 1)),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(path.basename(target)).replace(/'/g, "%27")}`,
      "Accept-Ranges": "bytes", "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff", "Content-Security-Policy": browserMedia ? "default-src 'none'; media-src 'self' blob:; object-src 'self' blob:" : "sandbox; default-src 'none'",
    });
    if (range) headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
    const body = info.size === 0 || request.method === "HEAD" ? null : Readable.toWeb(createReadStream(target, { start, end })) as ReadableStream;
    return new Response(body, { status: range ? 206 : 200, headers });
  }

  async function usage() {
    const items = (await searchItems("")).value;
    const disk = await fs.statfs(await rootPath());
    return { files: items.filter((i) => i.file).length, folders: items.filter((i) => i.folder).length,
      bytes: items.reduce((sum, i) => sum + i.size, 0), plannedBytes: MAX_FILE_BYTES, freeBytes: disk.bavail * disk.bsize };
  }

  async function locked<T>(operation: () => Promise<T>) {
    return withDirectoryLock(path.join(await rootPath(), `${PRIVATE_PREFIX}operations-lock`), operation, 30000);
  }

  return { listChildren, searchItems, readText, download, listTrash, listVersions, usage,
    createFolder: (...args: Parameters<typeof createFolder>) => locked(() => createFolder(...args)),
    renameDriveItem: (...args: Parameters<typeof renameDriveItem>) => locked(() => renameDriveItem(...args)),
    deleteDriveItem: (...args: Parameters<typeof deleteDriveItem>) => locked(() => deleteDriveItem(...args)),
    upload: (...args: Parameters<typeof upload>) => locked(() => upload(...args)),
    restoreTrash: (...args: Parameters<typeof restoreTrash>) => locked(() => restoreTrash(...args)),
    saveVersion: (...args: Parameters<typeof saveVersion>) => locked(() => saveVersion(...args)),
    replaceContent: (...args: Parameters<typeof replaceContent>) => locked(() => replaceContent(...args)),
    restoreVersion: (...args: Parameters<typeof restoreVersion>) => locked(() => restoreVersion(...args)),
    getItem: async (id: string) => summary(await resolveItem(id)) };
}
