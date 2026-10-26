import SearchUI from "./SearchUI";
import { requireUser } from "@/lib/authToken";

export const revalidate = 0;

export default async function SearchPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  return <SearchUI isAdmin={isAdmin} />;
}
