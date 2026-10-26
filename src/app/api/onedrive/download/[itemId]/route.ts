import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import { appConfig } from "@/lib/config";
import { ForbiddenError, toErrorResponse } from "@/lib/errors";
import { isOriginAllowed, localDrive } from "@/services/onedrive/repo";
import { apiUser, assertPermission, workspaceStore } from "@/lib/authToken";
import { pathFromId } from "@/lib/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const user = await apiUser(req);
    assertPermission(user, req.nextUrl.searchParams.get("inline") === "1" ? "read" : "download", itemId);
    assertAllowedOrigin(req);
    verifySignature(req, itemId);

    const response = await localDrive.download(itemId, req);
    if (req.method === "GET" && req.nextUrl.searchParams.get("inline") !== "1" && response.ok) {
      try { await (await workspaceStore()).audit(user, "Descarga iniciada", pathFromId(itemId)); }
      catch (error) { await response.body?.cancel(); throw error; }
    }
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const HEAD = GET;

function assertAllowedOrigin(req: NextRequest) {
  const originHeader = req.headers.get("origin");
  const refererHeader = req.headers.get("referer");
  if (!originHeader && !refererHeader) return;
  // Next normalizes nextUrl to localhost; retain the actual host used on the LAN.
  const requestHost = req.headers.get("host");
  const selfOrigin = requestHost ? new URL(`${req.nextUrl.protocol}//${requestHost}`).origin : req.nextUrl.origin;

  const originAllowed = originHeader ? isOriginAllowed(originHeader, selfOrigin) : false;
  const refererAllowed = refererHeader ? isOriginAllowed(refererHeader, selfOrigin) : false;

  if (originAllowed || refererAllowed) {
    return;
  }

  throw new ForbiddenError("Origen de la solicitud no permitido");
}

function verifySignature(req: NextRequest, itemId: string) {
  const secret = appConfig.DOWNLOAD_TOKEN_SECRET;
  if (!secret) {
    return;
  }

  const params = req.nextUrl.searchParams;
  const signature = params.get("sig") ?? params.get("signature");
  const expires = params.get("exp") ?? params.get("expires");

  // A session and folder permission are always required. Signatures, when present, are also checked.
  if (!signature && !expires) return;
  if (!signature || !expires) {
    throw new ForbiddenError("Falta la firma de descarga");
  }

  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt)) {
    throw new ForbiddenError("La fecha de caducidad de la firma no es válida");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (expiresAt < nowSeconds) {
    throw new ForbiddenError("El enlace de descarga ha caducado");
  }

  const payload = `${itemId}:${expiresAt}`;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");

  let providedBuffer: Buffer;
  let expectedBuffer: Buffer;
  try {
    providedBuffer = Buffer.from(signature, "base64url");
    expectedBuffer = Buffer.from(expected, "base64url");
  } catch {
    throw new ForbiddenError("El formato de la firma de descarga no es válido");
  }

  if (providedBuffer.length !== expectedBuffer.length) {
    throw new ForbiddenError("La firma de descarga no es válida");
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new ForbiddenError("La firma de descarga no es válida");
  }
}
