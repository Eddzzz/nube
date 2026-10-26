import { networkInterfaces } from "node:os";
import { BadRequestError } from "./errors";

type Interfaces = ReturnType<typeof networkInterfaces>;
const loopback = (host: string) => /^(localhost|127(?:\.\d+){3}|\[?::1\]?)$/i.test(host);
const privateIpv4 = (ip: string) => /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(ip);

/** The QR contains only a local locator; forwarded headers never choose its host. */
export function getShareOrigin(
  request: { url: string; headers: Pick<Headers, "get"> },
  options: { baseUrl?: string; interfaces?: Interfaces } = {},
): string {
  const configured = options.baseUrl ?? process.env.SHARE_BASE_URL;
  const parse = (value: string) => {
    let url: URL;
    try { url = new URL(value); } catch { throw new BadRequestError("La dirección para compartir no es válida"); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || loopback(url.hostname)) {
      throw new BadRequestError("Configura una dirección HTTP o HTTPS accesible desde la red, sin localhost");
    }
    return url;
  };
  if (configured) return parse(configured).origin;
  const source = new URL(request.url);
  const host = request.headers.get("host");
  const requested = new URL(`${source.protocol}//${host || source.host}`);
  if (!loopback(requested.hostname)) return parse(requested.href).origin;
  const candidates = Object.entries(options.interfaces ?? networkInterfaces())
    .flatMap(([name, entries]) => (entries ?? []).map((entry) => ({ ...entry, name })))
    .filter((entry) => !entry.internal && entry.family === "IPv4" && privateIpv4(entry.address))
    .sort((a, b) => Number(/virtual|vmware|vbox|wsl|docker|vethernet/i.test(a.name)) - Number(/virtual|vmware|vbox|wsl|docker|vethernet/i.test(b.name)) || a.name.localeCompare(b.name));
  if (!candidates.length) throw new BadRequestError("No se encontró una IP local. Conecta el servidor a la red o configura SHARE_BASE_URL");
  requested.hostname = candidates[0].address;
  return requested.origin;
}

export function shareExpiry(duration: unknown = "7d", now = Date.now()): string {
  if (duration === "never") return "";
  const days = duration === "24h" ? 1 : duration === "7d" ? 7 : duration === "30d" ? 30 : 0;
  if (!days) throw new BadRequestError("Selecciona una duración válida para el enlace");
  return new Date(now + days * 86400000).toISOString();
}
