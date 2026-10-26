import type { NextRequest } from "next/server";
import { assertAdmin } from "@/app/api/onedrive/utils";
import { toErrorResponse } from "@/lib/errors";
import { connectionStatus, disconnect } from "@/services/onedrive/connection";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try { await assertAdmin(req); return Response.json(await connectionStatus(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return toErrorResponse(error); }
}
export async function DELETE(req: NextRequest) {
  try { await assertAdmin(req); await disconnect(); return Response.json({ ok: true }); }
  catch (error) { return toErrorResponse(error); }
}
