import { requireUser } from "@/lib/authToken";
import ProjectPanel from "@/features/workspace/ProjectPanel";

export default async function ProjectPage() {
  await requireUser();
  return <ProjectPanel />;
}
