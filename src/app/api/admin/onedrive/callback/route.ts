import type { NextRequest } from "next/server";
import { assertAdmin } from "@/app/api/onedrive/utils";
import { SESSION_COOKIE } from "@/lib/authToken";
import { completeAuthorization } from "@/services/onedrive/connection";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  let location = "/admin/storage?error=connection";
  try {
    await assertAdmin(req);
    await completeAuthorization({ state: req.nextUrl.searchParams.get("state") || "", code: req.nextUrl.searchParams.get("code") || "", sessionToken: req.cookies.get(SESSION_COOKIE)?.value || "" });
    location = "/admin/storage?connected=1";
  } catch { /* OAuth details and credentials never enter redirects or logs. */ }
  return new Response(null, { status: 303, headers: { Location: location, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
