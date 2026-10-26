import { z } from "zod";

const parsed = z.object({
  LOCAL_DRIVE_ROOT: z.string().default(""),
  DOWNLOAD_TOKEN_SECRET: z.string().optional(),
  DOWNLOAD_ALLOWED_ORIGINS: z.string().optional(),
}).safeParse({
  LOCAL_DRIVE_ROOT: process.env.LOCAL_DRIVE_ROOT,
  DOWNLOAD_TOKEN_SECRET: process.env.DOWNLOAD_TOKEN_SECRET,
  DOWNLOAD_ALLOWED_ORIGINS: process.env.DOWNLOAD_ALLOWED_ORIGINS,
});

if (!parsed.success) {
  const message = Object.values(parsed.error.flatten().fieldErrors).flat().join(", ");
  throw new Error("Variables de entorno no válidas: " + message);
}

export const appConfig = {
  LOCAL_DRIVE_ROOT: parsed.data.LOCAL_DRIVE_ROOT,
  DOWNLOAD_TOKEN_SECRET: parsed.data.DOWNLOAD_TOKEN_SECRET || null,
  downloadAllowedOrigins: parsed.data.DOWNLOAD_ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? [],
};
