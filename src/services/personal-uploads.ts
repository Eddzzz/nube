import { can, type Identity } from "../lib/permissions";

/** Membership offers destinations, but never adds file permissions. */
export function uploadPathsFor(user: Identity, projectPaths: string[]): string[] {
  const candidates = [...user.grants.map((grant) => grant.path), ...projectPaths];
  if (user.role === "admin") candidates.unshift("");
  const seen = new Set<string>();
  return candidates.filter((value) => {
    const key = value.normalize("NFC").toLowerCase();
    if (seen.has(key) || !can(user, "upload", value)) return false;
    seen.add(key);
    return true;
  });
}
