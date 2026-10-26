import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, workspaceStore } from "@/lib/authToken";
import { getStorageMode } from "@/services/onedrive/connection";

async function forward(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  // Never trust the client's choice of backend, including on QR and callback routes.
  const selected = await getStorageMode().catch(() => "unavailable");
  requestHeaders.set("x-onedrivelist-storage", selected);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/login") return forward(req);
  // Permitir acceso a la vista de elementos compartidos por QR
  if (pathname.startsWith("/share/")) return forward(req);
  // Permitir llamadas GET a la API pública de elementos compartidos
  if (pathname.startsWith("/api/share/") && req.method === "GET") return forward(req);

  try {
    const user = await (await workspaceStore()).getSession(req.cookies.get(SESSION_COOKIE)?.value);
    if (user) {
      if ((pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) && user.role !== "admin") {
        return new NextResponse("Se requieren permisos de administrador", { status: 403 });
      }
      const response = await forward(req);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
  } catch {
    if (pathname.startsWith("/api/")) return new NextResponse("No se pudo verificar la sesión", { status: 503 });
  }
  if (pathname.startsWith("/api/")) return new NextResponse("Inicia sesión para continuar", { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  runtime: "nodejs",
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
