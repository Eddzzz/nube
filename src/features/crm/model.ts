import type { Account } from "../../lib/permissions";
import type { Audit, Check, CrmJob, CrmTodo, CrmProject, Task } from "../../services/workspace-store";

export type CrmData = {
  projects: CrmProject[]; jobs: CrmJob[]; todos: CrmTodo[]; users: Account[]; audit: Audit[]; checks: Check[]; academicTasks: Task[];
  usage: { files: number; folders: number; bytes: number; plannedBytes: number; freeBytes: number };
};
export const JOB_LABELS = { planned: "Planificado", active: "En curso", review: "En revisión", completed: "Completado", cancelled: "Cancelado" };
export const TODO_LABELS = { pending: "Pendiente", progress: "En proceso", completed: "Completado" };
export const PRIORITY_LABELS = { low: "Baja", normal: "Normal", high: "Alta" };

export function todayLaPaz(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function summarizeCrm(data: Pick<CrmData, "jobs" | "todos" | "users">, now = new Date()) {
  const today = todayLaPaz(now);
  const openJobs = data.jobs.filter((job) => job.status !== "completed" && job.status !== "cancelled");
  const openTodos = data.todos.filter((todo) => todo.status !== "completed");
  return {
    activeUsers: data.users.filter((user) => user.active).length,
    administrators: data.users.filter((user) => user.active && user.role === "admin").length,
    openJobs: openJobs.length, openTodos: openTodos.length,
    completedTodos: data.todos.length - openTodos.length,
    overdueTodos: openTodos.filter((todo) => todo.due && todo.due < today).length,
    dueToday: openTodos.filter((todo) => todo.due === today).length,
    workload: data.users.map((user) => ({ ...user, jobs: openJobs.filter((job) => job.assigneeId === user.id).length, todos: openTodos.filter((todo) => todo.assigneeId === user.id).length })),
    upcoming: [...openTodos].filter((todo) => todo.due).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 6),
    unassigned: openTodos.filter((todo) => !todo.assigneeId).length,
  };
}

export function activityDays(events: Pick<Audit, "at">[], now = new Date()) {
  const today = todayLaPaz(now);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() - (6 - i));
    const day = date.toISOString().slice(0, 10);
    return { date: day, count: events.filter((event) => todayLaPaz(new Date(event.at)) === day).length };
  });
}
