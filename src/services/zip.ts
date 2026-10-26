import { BadRequestError, ForbiddenError } from "../lib/errors";
import { can, pathFromId, type Identity } from "../lib/permissions";
import type { DriveItemSummary } from "./onedrive/repo";

export const MAX_ZIP_BYTES = 200 * 1024 * 1024;
export const MAX_ZIP_ENTRIES = 1000;
export type ZipEntry = { id: string; path: string; size: number; folder: boolean; modified: string };
type Catalog = {
  getItem(id: string): Promise<DriveItemSummary>;
  listChildren(id: string): Promise<{ value: DriveItemSummary[] }>;
};
type ContentSource = { download(id: string, request: Request): Promise<Response> };

/** Validate the entire selection before sending any archive bytes. */
export async function prepareZip(drive: Catalog, user: Identity, ids: unknown): Promise<ZipEntry[]> {
  if (!Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some((id) => typeof id !== "string" || !id)) {
    throw new BadRequestError("Selecciona entre 1 y 100 archivos o carpetas para descargar");
  }
  const entries: ZipEntry[] = [];
  const seen = new Set<string>();
  let bytes = 0;
  async function visit(item: DriveItemSummary) {
    const relative = pathFromId(item.id);
    if (!relative) throw new BadRequestError("Selecciona archivos o carpetas del repositorio");
    if (!can(user, "download", relative)) throw new ForbiddenError("No tienes permiso de descarga para todos los elementos de la selección");
    const key = relative.normalize("NFC").toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    if (entries.length >= MAX_ZIP_ENTRIES) throw new BadRequestError("Cada ZIP admite hasta 1.000 archivos y carpetas");
    const folder = Boolean(item.folder);
    const size = folder ? 0 : item.size;
    if (!Number.isSafeInteger(size) || size < 0 || bytes + size > MAX_ZIP_BYTES) throw new BadRequestError("Cada ZIP admite hasta 200 MB de archivos");
    bytes += size;
    entries.push({ id: item.id, path: relative + (folder ? "/" : ""), size, folder, modified: item.lastModifiedDateTime });
    if (folder) for (const child of (await drive.listChildren(item.id)).value) await visit(child);
  }
  for (const id of ids as string[]) {
    const relative = pathFromId(id);
    if (!relative || !can(user, "download", relative)) throw new ForbiddenError("No tienes permiso para descargar esta selección");
    await visit(await drive.getItem(id));
  }
  return entries;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
function updateCrc(crc: number, bytes: Uint8Array) {
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return crc;
}
function dosTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { time: 0, date: 33 };
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >>> 1),
    date: ((Math.max(1980, Math.min(2107, date.getFullYear())) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

type StreamState = { reader?: ReadableStreamDefaultReader<Uint8Array> };
async function* encodeZip(drive: ContentSource, entries: ZipEntry[], request: Request, state: StreamState): AsyncGenerator<Uint8Array> {
  const central: Buffer[] = [];
  let offset = 0;
  let totalBytes = 0;
  for (const entry of entries) {
    request.signal.throwIfAborted();
    const filename = Buffer.from(entry.path, "utf8");
    const stamp = dosTimestamp(entry.modified);
    const start = offset;
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0808, 6); // UTF-8 names and trailing data descriptor.
    header.writeUInt16LE(stamp.time, 10);
    header.writeUInt16LE(stamp.date, 12);
    header.writeUInt16LE(filename.length, 26);
    yield Buffer.concat([header, filename]);
    offset += header.length + filename.length;

    let crc = 0xffffffff;
    let size = 0;
    if (!entry.folder) {
      const source = await drive.download(entry.id, new Request(request.url, { signal: request.signal }));
      if (!source.ok) throw new BadRequestError("No se pudo leer un archivo de la selección");
      if (source.body) {
        const reader = source.body.getReader();
        state.reader = reader;
        const abort = () => { void reader.cancel().catch(() => {}); };
        request.signal.addEventListener("abort", abort, { once: true });
        try {
          for (;;) {
            request.signal.throwIfAborted();
            const chunk = await reader.read();
            request.signal.throwIfAborted();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            totalBytes += chunk.value.byteLength;
            if (totalBytes > MAX_ZIP_BYTES || size > entry.size) throw new BadRequestError("El archivo cambió durante la descarga. Actualiza la lista y vuelve a intentarlo.");
            crc = updateCrc(crc, chunk.value);
            offset += chunk.value.byteLength;
            yield chunk.value;
          }
        } finally {
          request.signal.removeEventListener("abort", abort);
          await reader.cancel().catch(() => {});
          reader.releaseLock();
          state.reader = undefined;
        }
      }
      if (size !== entry.size) throw new BadRequestError("El archivo cambió durante la descarga. Actualiza la lista y vuelve a intentarlo.");
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const descriptor = Buffer.alloc(16);
    descriptor.writeUInt32LE(0x08074b50, 0);
    descriptor.writeUInt32LE(crc, 4);
    descriptor.writeUInt32LE(size, 8);
    descriptor.writeUInt32LE(size, 12);
    yield descriptor;
    offset += descriptor.length;

    const index = Buffer.alloc(46);
    index.writeUInt32LE(0x02014b50, 0);
    index.writeUInt16LE(20, 4);
    index.writeUInt16LE(20, 6);
    index.writeUInt16LE(0x0808, 8);
    index.writeUInt16LE(stamp.time, 12);
    index.writeUInt16LE(stamp.date, 14);
    index.writeUInt32LE(crc, 16);
    index.writeUInt32LE(size, 20);
    index.writeUInt32LE(size, 24);
    index.writeUInt16LE(filename.length, 28);
    index.writeUInt32LE(entry.folder ? 0x10 : 0x20, 38);
    index.writeUInt32LE(start, 42);
    central.push(Buffer.concat([index, filename]));
  }
  const centralOffset = offset;
  for (const entry of central) { yield entry; offset += entry.length; }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(offset - centralOffset, 12);
  end.writeUInt32LE(centralOffset, 16);
  yield end;
}

/** STORE mode streams file content without buffering the archive in server memory. */
export function createZipStream(drive: ContentSource, entries: ZipEntry[], request: Request): ReadableStream<Uint8Array> {
  const state: StreamState = {};
  const iterator = encodeZip(drive, entries, request, state);
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) controller.close(); else controller.enqueue(next.value);
      } catch (error) { controller.error(error); }
    },
    async cancel() {
      await state.reader?.cancel().catch(() => {});
      await iterator.return(undefined);
    },
  });
}
