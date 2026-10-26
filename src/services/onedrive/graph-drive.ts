import { createReadStream, createWriteStream } from "node:fs";
import * as fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { AppError, BadRequestError, ForbiddenError } from "../../lib/errors";
import { pathFromId, idFromPath, validatePath, isWithin } from "../../lib/permissions";
import { withDirectoryLock } from "../file-lock";
import type { RecoveryEntry } from "../local-drive";
import type { DriveItemSummary } from "./repo";
type Connection = {
    driveId: string;
    rootId: string;
    accountId: string;
    rootName: string;
};
type Item = {
    id: string;
    name: string;
    eTag?: string;
    size?: number;
    lastModifiedDateTime?: string;
    folder?: Record<string, unknown>;
    file?: {
        mimeType?: string;
    };
    remoteItem?: unknown;
    package?: unknown;
};
type Manifest = RecoveryEntry & {
    ownerId: string;
    payloadId?: string;
};
const MAX = 200 * 1024 * 1024;
const BASE = "https://graph.microsoft.com/v1.0";
const PRIVATE = ".onedrivelist-";
export function createOneDriveDrive(options: {
    getConnection: () => Promise<Connection | null>;
    getAccessToken: () => Promise<string>;
    fetch?: typeof fetch;
    dataDirectory?: () => Promise<string>;
}) {
    const fetcher = options.fetch ?? fetch;
    async function connection() { const value = await options.getConnection(); if (!value)
        throw new AppError("OneDrive no está conectado", 503); return value; }
    async function base() { const c = await connection(); return `/drives/${encodeURIComponent(c.driveId)}/items/${encodeURIComponent(c.rootId)}`; }
    async function endpoint(relative: string) { return (await base()) + (relative ? `:/${relative.split("/").map(encodeURIComponent).join("/")}:` : ""); }
    async function itemEndpoint(item: Item) { const c = await connection(); return `/drives/${encodeURIComponent(c.driveId)}/items/${encodeURIComponent(safe(item).id)}`; }
    function conditional(item: Item, init: RequestInit): RequestInit { if (!item.eTag) throw new AppError("El elemento cambió; vuelve a intentarlo", 409); const headers = new Headers(init.headers); headers.set("If-Match", item.eTag); return { ...init, headers }; }
    function safe(item: Item) { if (!item?.id || !item.name || item.remoteItem || item.package)
        throw new ForbiddenError("Elemento de OneDrive no permitido"); return item; }
    function name(value: string) { validatePath(value); if (!value || value.includes("/"))
        throw new BadRequestError("Nombre no válido"); }
    async function request(url: string, init: RequestInit = {}) {
        const target = (url.startsWith("/") ? BASE + url : url).replace(/:(?=\?|$)/, "");
        const parsed = new URL(target);
        if (parsed.origin !== "https://graph.microsoft.com" || !parsed.pathname.startsWith("/v1.0/drives/") || parsed.username || parsed.password || parsed.hash)
            throw new ForbiddenError();
        const headers = new Headers(init.headers);
        headers.set("Authorization", `Bearer ${await options.getAccessToken()}`);
        let response: Response;
        try {
            response = await fetcher(target, { ...init, headers, redirect: "manual" });
        }
        catch {
            throw new AppError("No se pudo contactar con OneDrive", 503);
        }
        if (!response.ok && ![301, 302, 303, 307, 308].includes(response.status))
            throw new AppError("No se pudo completar la operación de OneDrive", response.status === 412 ? 409 : [401, 403, 404, 409, 429].includes(response.status) ? response.status : 503);
        return response;
    }
    async function json<T>(url: string, init?: RequestInit): Promise<T> { const response = await request(url, init); if (!response.ok)
        throw new AppError("Respuesta de OneDrive no válida", 503); return response.json() as Promise<T>; }
    const body = (value: unknown, method = "POST"): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
    async function resolve(relative: string, internal = false) {
        if (!internal)
            validatePath(relative);
        let item = safe(await json<Item>(await base()));
        let current = "";
        for (const segment of relative.split("/").filter(Boolean)) {
            if (!item.folder)
                throw new BadRequestError("El destino debe ser una carpeta");
            current = current ? current + "/" + segment : segment;
            item = safe(await json<Item>(await endpoint(current)));
            if (item.name.normalize("NFC").toLowerCase() !== segment.normalize("NFC").toLowerCase())
                throw new ForbiddenError("Ruta de OneDrive no válida");
        }
        return item;
    }
    function summary(item: Item, relative: string): DriveItemSummary { safe(item); return { id: idFromPath(relative), name: item.name, size: item.folder ? 0 : item.size ?? 0, lastModifiedDateTime: item.lastModifiedDateTime ?? new Date(0).toISOString(), ...(item.folder ? { folder: {} } : { file: { mimeType: item.file?.mimeType ?? "application/octet-stream" } }) }; }
    async function children(relative: string, internal = false) {
        const parent = await resolve(relative, internal);
        if (!parent.folder)
            throw new BadRequestError("Selecciona una carpeta");
        const initial = BASE + await endpoint(relative) + "/children";
        const allowed = new URL(initial).pathname;
        let next: string | undefined = initial;
        const result: Item[] = [];
        const seen = new Set<string>();
        while (next) {
            const url = new URL(next);
            if (url.origin !== "https://graph.microsoft.com" || url.pathname !== allowed || url.username || url.password || url.hash || seen.has(next))
                throw new ForbiddenError("Paginación de OneDrive no válida");
            seen.add(next);
            const page: {
                value: Item[];
                "@odata.nextLink"?: string;
            } = await json(next);
            if (!Array.isArray(page.value))
                throw new AppError("Respuesta de OneDrive no válida", 503);
            result.push(...page.value.filter((item) => !item.remoteItem && !item.package && (internal || !item.name.toLowerCase().startsWith(PRIVATE))));
            next = page["@odata.nextLink"];
        }
        return result;
    }
    async function listChildren(id?: string) { const relative = pathFromId(id); const items = await children(relative); return { value: items.map((item) => { name(item.name); return summary(item, relative ? relative + "/" + item.name : item.name); }).sort((a, b) => Number(Boolean(b.folder)) - Number(Boolean(a.folder)) || a.name.localeCompare(b.name, "es")) }; }
    async function getItem(id: string) { const relative = pathFromId(id); return summary(await resolve(relative), relative); }
    async function searchItems(query: string) { const value: DriveItemSummary[] = []; const pending = [""]; while (pending.length) {
        const page = await listChildren(pending.pop());
        for (const item of page.value) {
            if (item.name.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")))
                value.push(item);
            if (item.folder)
                pending.push(item.id);
        }
    } return { value }; }
    async function ensureFolder(relative: string) {
        try {
            const item = await resolve(relative, true);
            if (!item.folder)
                throw new ForbiddenError();
            return item;
        }
        catch (error) {
            if (!(error instanceof AppError) || error.status !== 404)
                throw error;
            const parent = relative.split("/").slice(0, -1).join("/");
            if (parent)
                await ensureFolder(parent);
            try {
                return safe(await json<Item>(await endpoint(parent) + "/children", body({ name: relative.split("/").at(-1), folder: {}, "@microsoft.graph.conflictBehavior": "fail" })));
            }
            catch (e) {
                if (e instanceof AppError && e.status === 409)
                    return resolve(relative, true);
                throw e;
            }
        }
    }
    async function createFolder({ name: filename, parentId, conflictBehavior = "rename" }: {
        name: string;
        parentId?: string;
        conflictBehavior?: "fail" | "replace" | "rename";
    }) {
        name(filename);
        const parent = pathFromId(parentId);
        await resolve(parent);
        for (let i = 0; i < 10000; i++) {
            const candidate = candidateName(filename, i);
            try {
                const item = await json<Item>(await endpoint(parent) + "/children", body({ name: candidate, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }));
                name(item.name);
                return summary(item, parent ? parent + "/" + item.name : item.name);
            }
            catch (e) {
                if (!(e instanceof AppError) || e.status !== 409 || conflictBehavior !== "rename")
                    throw e;
            }
        }
        throw new AppError("Demasiados nombres duplicados", 409);
    }
    function candidateName(filename: string, index: number) { if (!index)
        return filename; const ext = path.posix.extname(filename); const result = `${filename.slice(0, filename.length - ext.length)} (${index})${ext}`; name(result); return result; }
    async function put(relative: string, content: BodyInit, exclusive = false, signal?: AbortSignal, length?: number, pinned?: Item) {
        const headers = new Headers({ "Content-Type": "application/octet-stream" });
        if (length !== undefined)
            headers.set("Content-Length", String(length));
        if (exclusive)
            headers.set("If-None-Match", "*");
        const init = { method: "PUT", headers, body: content, signal, duplex: "half" } as RequestInit;
        return safe(await json<Item>((pinned ? await itemEndpoint(pinned) : await endpoint(relative)) + "/content" + (exclusive ? "?%40microsoft.graph.conflictBehavior=fail" : ""), pinned ? conditional(pinned, init) : init));
    }
    async function stage(request: Request) {
        const declared = request.headers.get("content-length");
        if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX))
            throw new BadRequestError("Cada archivo admite hasta 200 MB");
        const directory = await fs.mkdtemp(path.join(tmpdir(), "onedrivelist-upload-"));
        const filename = path.join(directory, "content");
        try {
            if (request.body) {
                let received = 0;
                const limiter = new Transform({ transform(chunk, _encoding, callback) { received += chunk.length; callback(received > MAX ? new BadRequestError("Cada archivo admite hasta 200 MB") : null, chunk); } });
                await pipeline(Readable.fromWeb(request.body as import("node:stream/web").ReadableStream), limiter, createWriteStream(filename, { flags: "wx" }), { signal: request.signal });
            }
            else
                await fs.writeFile(filename, "");
            return { directory, filename, size: (await fs.stat(filename)).size };
        }
        catch (e) {
            await fs.rm(directory, { recursive: true, force: true });
            throw e;
        }
    }
    async function upload(request: Request, filename: string, parentId?: string) {
        name(filename);
        const relative = pathFromId(parentId);
        const parent = await resolve(relative);
        if (!parent.folder)
            throw new BadRequestError("Selecciona una carpeta");
        const staged = await stage(request);
        try {
            for (let i = 0; i < 10000; i++) {
                const candidate = candidateName(filename, i);
                const target = relative ? relative + "/" + candidate : candidate;
                try {
                    const item = await put(target, createReadStream(staged.filename) as unknown as BodyInit, true, request.signal, staged.size);
                    name(item.name);
                    return summary(item, relative ? relative + "/" + item.name : item.name);
                }
                catch (e) {
                    if (!(e instanceof AppError) || e.status !== 409)
                        throw e;
                }
            }
            throw new AppError("Demasiados nombres duplicados", 409);
        }
        finally {
            await fs.rm(staged.directory, { recursive: true, force: true });
        }
    }
    async function content(relative: string, signal?: AbortSignal, range?: string, pinned?: Item) {
        const item = pinned ?? await resolve(relative, true); if(item.folder) throw new BadRequestError("Selecciona un archivo");
        const headers = new Headers();
        if (range)
            headers.set("Range", range);
        let response = await request(await itemEndpoint(item) + "/content", conditional(item, { headers, signal }));
        for (let i = 0; i < 5 && response.status >= 300 && response.status < 400; i++) {
            const location = response.headers.get("location");
            if (!location)
                throw new AppError("Descarga de OneDrive no válida", 503);
            const url = new URL(location);
            if (url.protocol !== "https:" || url.username || url.password || url.port || !(["onedrive.live.com", "1drv.com", "sharepoint.com"].some(host => url.hostname === host || url.hostname.endsWith("." + host))))
                throw new ForbiddenError("Destino de descarga no permitido");
            try {
                response = await fetcher(url, { headers, signal, redirect: "manual" });
            }
            catch {
                throw new AppError("No se pudo descargar de OneDrive", 503);
            }
        }
        if (!response.ok)
            throw new AppError("No se pudo descargar de OneDrive", response.status === 404 ? 404 : 503);
        return response;
    }
    async function readText(id: string) { const relative = pathFromId(id); const item = await resolve(relative); if (item.folder || (item.size ?? 0) > 5 * 1024 * 1024)
        throw new BadRequestError("La vista previa de texto admite hasta 5 MB"); const response = await content(relative, undefined, undefined, item); const reader = response.body?.getReader(); let total = 0; const chunks: Uint8Array[] = []; if (reader) {
        try {
            for (;;) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                total += value.length;
                if (total > 5 * 1024 * 1024)
                    throw new BadRequestError("La vista previa de texto admite hasta 5 MB");
                chunks.push(value);
            }
        }
        finally {
            await reader.cancel();
        }
    } return Buffer.concat(chunks).toString("utf8"); }
    async function download(id: string, request: Request) {
        const relative = pathFromId(id);
        const item = await resolve(relative);
        if (item.folder)
            throw new BadRequestError("Selecciona un archivo");
        const size = item.size ?? 0;
        let start = 0, end = size - 1;
        const range = request.headers.get("range");
        if (range) {
            const match = /^bytes=(\d*)-(\d*)$/.exec(range);
            if (match && (match[1] || match[2])) {
                start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
                end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
            }
            if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size)
                return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
        }
        const mime = item.file?.mimeType ?? "application/octet-stream";
        const media = mime === "application/pdf" || mime.startsWith("video/") || mime.startsWith("audio/");
        const inline = new URL(request.url).searchParams.get("inline") === "1";
        const headers = new Headers({ "Content-Type": mime, "Content-Length": String(Math.max(0, end - start + 1)), "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(item.name).replace(/'/g, "%27")}`, "Accept-Ranges": "bytes", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": media ? "default-src 'none'; media-src 'self' blob:; object-src 'self' blob:" : "sandbox; default-src 'none'" });
        if (range)
            headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
        if (request.method === "HEAD" || !size)
            return new Response(null, { status: range ? 206 : 200, headers });
        const response = await content(relative, request.signal, range ? `bytes=${start}-${end}` : undefined, item);
        if (range && response.status !== 206) {
            await response.body?.cancel();
            throw new AppError("OneDrive no admitió el rango solicitado", 503);
        }
        return new Response(response.body, { status: range ? 206 : 200, headers });
    }
    function recoveryPath(kind: "trash" | "versions", id: string) { if (!/^[a-f0-9-]{36}$/.test(id))
        throw new BadRequestError("Identificador de recuperación no válido"); return `${PRIVATE}${kind}/${id}`; }
    async function manifest(kind: "trash" | "versions", id: string): Promise<Manifest> { const relative = recoveryPath(kind, id); const response = await content(relative + "/metadata.json"); const value = await response.json() as Manifest; validatePath(value.originalPath); name(value.name); if (value.name !== value.originalPath.split("/").at(-1) || !value.ownerId || value.id !== id)
        throw new BadRequestError("Metadatos de recuperación no válidos"); return value; }
    async function writeManifest(kind: "trash" | "versions", value: Manifest) { await put(recoveryPath(kind, value.id) + "/metadata.json", JSON.stringify(value)); }
    async function entries(kind: "trash" | "versions") { let folders: Item[]; try {
        folders = await children(PRIVATE + kind, true);
    }
    catch (e) {
        if (e instanceof AppError && e.status === 404)
            return [];
        throw e;
    } const result: Manifest[] = []; for (const item of folders) {
        if (!item.folder || !/^[a-f0-9-]{36}$/.test(item.name))
            continue;
        try {
            const value = await manifest(kind, item.name);
            await resolve(recoveryPath(kind, item.name) + "/payload", true);
            result.push(value);
        }
        catch (e) {
            if (!(e instanceof AppError) || e.status !== 404)
                throw e;
        }
    } return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
    async function listTrash() { return entries("trash"); }
    async function listVersions(id: string) { const item = await resolve(pathFromId(id)); const trash = await entries("trash"); return (await entries("versions")).filter(entry => entry.ownerId === item.id && !trash.some(deleted => deleted.versionIds?.includes(entry.id))); }
    async function saveVersion(id: string, pinned?: Item) { const relative = pathFromId(id), item = pinned ?? await resolve(relative); if (item.folder || (item.size ?? 0) > MAX)
        throw new BadRequestError("Las versiones admiten archivos de hasta 200 MB"); const entry: Manifest = { id: randomUUID(), originalPath: relative, name: item.name, createdAt: new Date().toISOString(), size: item.size ?? 0, folder: false, ownerId: item.id }; await ensureFolder(recoveryPath("versions", entry.id)); const response = await content(relative, undefined, undefined, item); const staged = await stage(new Request("http://localhost/snapshot", { method: "PUT", body: response.body, duplex: "half" } as RequestInit)); try {
        await put(recoveryPath("versions", entry.id) + "/payload", createReadStream(staged.filename) as unknown as BodyInit, true, undefined, staged.size);
        await writeManifest("versions", entry);
        return entry;
    }
    finally {
        await fs.rm(staged.directory, { recursive: true, force: true });
    } }
    async function move(source: Item, parent: string, filename: string) { const destination = await resolve(parent, true); if (!destination.folder)
        throw new BadRequestError("Selecciona una carpeta"); return safe(await json<Item>(await itemEndpoint(source), conditional(source, body({ name: filename, parentReference: { id: destination.id }, "@microsoft.graph.conflictBehavior": "fail" }, "PATCH")))); }
    async function deleteDriveItem(id: string) { const relative = pathFromId(id); if (!relative)
        throw new ForbiddenError(); const item = await resolve(relative); const owners = new Set([item.id]); if (item.folder) {
        const pending = [relative];
        while (pending.length) {
            const directory = pending.pop()!;
            for (const child of await children(directory)) {
                name(child.name);
                owners.add(child.id);
                if (child.folder)
                    pending.push(directory + "/" + child.name);
            }
        }
    } const entry: Manifest = { id: randomUUID(), originalPath: relative, name: item.name, createdAt: new Date().toISOString(), size: item.size ?? 0, folder: Boolean(item.folder), ownerId: item.id, versionIds: (await entries("versions")).filter(value => owners.has(value.ownerId)).map(value => value.id) }; await ensureFolder(recoveryPath("trash", entry.id)); await writeManifest("trash", entry); await move(item, recoveryPath("trash", entry.id), "payload"); }
    async function assertAbsent(relative: string) { try {
        await resolve(relative, true);
    }
    catch (e) {
        if (e instanceof AppError && e.status === 404)
            return;
        throw e;
    } throw new AppError("Ya existe un elemento con ese nombre", 409); }
    async function removeRecovery(kind: "trash" | "versions", id: string) { const item = await resolve(recoveryPath(kind, id), true); await request(await itemEndpoint(item), conditional(item, { method: "DELETE" })); }
    async function restoreTrash(id: string) { const entry = await manifest("trash", id); await assertAbsent(entry.originalPath); const parent = entry.originalPath.split("/").slice(0, -1).join("/"); await resolve(parent); const item = await move(await resolve(recoveryPath("trash", id) + "/payload", true), parent, entry.name); await removeRecovery("trash", id); return summary(item, entry.originalPath); }
    async function renameDriveItem(id: string, filename: string) { name(filename); const relative = pathFromId(id); if (!relative)
        throw new ForbiddenError(); const source = await resolve(relative); const parent = relative.split("/").slice(0, -1).join("/"); const target = parent ? parent + "/" + filename : filename; if (target === relative)
        return summary(source, relative); if (target.toLowerCase() !== relative.toLowerCase())
        await assertAbsent(target); const item = await json<Item>(await itemEndpoint(source), conditional(source, body({ name: filename, "@microsoft.graph.conflictBehavior": "fail" }, "PATCH"))); for (const entry of await entries("versions")) {
        if (isWithin(relative, entry.originalPath)) {
            entry.originalPath = target + entry.originalPath.slice(relative.length);
            entry.name = entry.originalPath.split("/").at(-1)!;
            await writeManifest("versions", entry);
        }
    } return summary(item, target); }
    async function replaceContent(id: string, request: Request, pinned?: Item) { const relative = pathFromId(id); const item = pinned ?? await resolve(relative); if (item.folder)
        throw new BadRequestError("Selecciona un archivo"); const staged = await stage(request); try {
        await saveVersion(id, item);
        return summary(await put(relative, createReadStream(staged.filename) as unknown as BodyInit, false, request.signal, staged.size, item), relative);
    }
    finally {
        await fs.rm(staged.directory, { recursive: true, force: true });
    } }
    async function restoreVersion(id: string, versionId: string) { const relative = pathFromId(id), item = await resolve(relative); const entry = (await listVersions(id)).find(value => value.id === versionId); if (!entry || entry.ownerId !== item.id)
        throw new ForbiddenError("La versión pertenece a otro archivo"); const response = await content(recoveryPath("versions", versionId) + "/payload"); return replaceContent(id, new Request("http://localhost/restore", { method: "PUT", body: response.body, duplex: "half" } as RequestInit), item); }
    async function usage() { const items = (await searchItems("")).value; const c = await connection(); const drive = await json<{
        quota?: {
            remaining?: number;
        };
    }>(`/drives/${encodeURIComponent(c.driveId)}`); return { files: items.filter(item => item.file).length, folders: items.filter(item => item.folder).length, bytes: items.reduce((sum, item) => sum + item.size, 0), plannedBytes: MAX, freeBytes: drive.quota?.remaining ?? 0 }; }
    async function locked<T>(operation: () => Promise<T>) { const c = await connection(); const directory = options.dataDirectory ? await options.dataDirectory() : tmpdir(); await fs.mkdir(directory, { recursive: true }); const key = createHash("sha256").update(c.driveId + ":" + c.rootId).digest("hex"); return withDirectoryLock(path.join(directory, "onedrive-" + key + "-lock"), operation, 30000); }
    return { listChildren, getItem, searchItems, readText, download, listTrash, listVersions, usage,
        createFolder: (...args: Parameters<typeof createFolder>) => locked(() => createFolder(...args)), renameDriveItem: (...args: Parameters<typeof renameDriveItem>) => locked(() => renameDriveItem(...args)), deleteDriveItem: (...args: Parameters<typeof deleteDriveItem>) => locked(() => deleteDriveItem(...args)), upload: (...args: Parameters<typeof upload>) => locked(() => upload(...args)), restoreTrash: (...args: Parameters<typeof restoreTrash>) => locked(() => restoreTrash(...args)), saveVersion: (...args: Parameters<typeof saveVersion>) => locked(() => saveVersion(...args)), replaceContent: (...args: Parameters<typeof replaceContent>) => locked(() => replaceContent(...args)), restoreVersion: (...args: Parameters<typeof restoreVersion>) => locked(() => restoreVersion(...args)) };
}
