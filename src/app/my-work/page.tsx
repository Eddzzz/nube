import { requireUser } from "@/lib/authToken";
import PersonalPanel from "@/features/workspace/PersonalPanel";

export default async function MyWorkPage() {
  await requireUser();
  return <PersonalPanel />;
}
