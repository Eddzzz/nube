import type { NextRequest } from "next/server";
import { assertAdmin } from "@/app/api/onedrive/utils";
import { SESSION_COOKIE } from "@/lib/authToken";
import { BadRequestError, toErrorResponse } from "@/lib/errors";
import { connectionStatus, createAuthorization } from "@/services/onedrive/connection";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    await assertAdmin(req);
    const status = await connectionStatus();
    if (status.configured && status.redirectUri && new URL(status.redirectUri).origin !== req.headers.get("origin")) {
      throw new BadRequestError("Abre el panel desde la dirección configurada para autorizar Microsoft e inicia sesión allí");
    }
    return Response.json({ url: await createAuthorization(req.cookies.get(SESSION_COOKIE)?.value || "") }, { headers: { "Cache-Control": "no-store" } });
  }
  catch (error) { return toErrorResponse(error); }
}
