import { prisma } from "../repositories/prisma";
import { AIUserContext } from "@iqoo/shared";

export class ContextBuilder {
  /**
   * Builds rich, structured context from the user's actual database records.
   */
  static async buildUserContext(
    userId: string,
    options?: {
      currentTaskId?: string;
      projectId?: string;
      availableHoursTonight?: number;
    }
  ): Promise<AIUserContext> {
    const [tasks, projects, focusSessions, inboxPendingCount] = await Promise.all([
      prisma.task.findMany({
        where: { userId },
        include: {
          project: { select: { name: true } },
          blockedBy: {
            include: { fromTask: { select: { id: true, title: true, status: true } } },
          },
          dependsOn: {
            include: { toTask: { select: { id: true, title: true, status: true } } },
          },
        },
        orderBy: [{ priority: "desc" }, { deadline: "asc" }],
      }),
      prisma.project.findMany({
        where: { userId },
        include: {
          tasks: { select: { id: true, status: true } },
        },
      }),
      prisma.focusSession.findMany({
        where: { userId },
        include: {
          task: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.actionInboxItem.count({
        where: { userId, status: "PENDING" },
      }),
    ]);

    const now = new Date();
    const activeTasks = tasks
      .filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED")
      .map((t) => {
        const blockers = t.blockedBy.map((b) => ({
          id: b.fromTask.id,
          title: b.fromTask.title,
          status: b.fromTask.status,
        }));
        const unblocks = t.dependsOn.map((d) => ({
          id: d.toTask.id,
          title: d.toTask.title,
          status: d.toTask.status,
        }));
        const isBlocked = blockers.some((b) => b.status !== "COMPLETED");

        let tags: string[] = [];
        try {
          tags = JSON.parse(t.tags || "[]");
        } catch {}

        return {
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          deadline: t.deadline,
          estimatedMinutes: t.estimatedMinutes,
          actualMinutes: t.actualMinutes,
          projectName: t.project?.name,
          projectId: t.projectId,
          tags,
          isBlocked,
          blockers,
          unblocks,
        };
      });

    const completedTasksCount = tasks.filter((t) => t.status === "COMPLETED").length;
    const recentCompletedTasks = tasks
      .filter((t) => t.status === "COMPLETED")
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 20)
      .map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        projectName: t.project?.name,
        estimatedMinutes: t.estimatedMinutes,
        actualMinutes: t.actualMinutes,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }));
    const overdueTasksCount = tasks.filter(
      (t) => t.deadline && new Date(t.deadline) < now && t.status !== "COMPLETED"
    ).length;

    const formattedProjects = projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      totalTasks: p.tasks.length,
      completedTasks: p.tasks.filter((t) => t.status === "COMPLETED").length,
    }));

    const formattedSessions = focusSessions.map((s) => ({
      taskId: s.taskId,
      taskTitle: s.task.title,
      durationMinutes: s.actualDuration || s.plannedDuration,
      plannedMinutes: s.plannedDuration,
      completedAt: s.endTime || s.createdAt,
    }));

    return {
      userId,
      activeTasks,
      completedTasksCount,
      recentCompletedTasks,
      overdueTasksCount,
      projects: formattedProjects,
      recentFocusSessions: formattedSessions,
      pendingInboxItemsCount: inboxPendingCount,
      availableHoursTonight: options?.availableHoursTonight,
    };
  }

  /**
   * Formats user context into a clean, concise prompt summary for LLM ingestion.
   */
  static formatContextForPrompt(ctx: AIUserContext): string {
    const lines: string[] = [];
    lines.push(`=== USER DATABASE REAL-TIME CONTEXT ===`);
    lines.push(`Total Active Tasks: ${ctx.activeTasks.length}`);
    lines.push(`Total Completed Tasks: ${ctx.completedTasksCount}`);
    lines.push(`Overdue Tasks: ${ctx.overdueTasksCount}`);
    if (ctx.recentCompletedTasks && ctx.recentCompletedTasks.length > 0) {
      lines.push(`\nRecent Completed Work (actual database history):`);
      for (const task of ctx.recentCompletedTasks) {
        const estimate = task.estimatedMinutes ? `${task.estimatedMinutes}m est` : "no estimate";
        const actual = task.actualMinutes ? `${task.actualMinutes}m actual` : "no actual duration";
        lines.push(`- [ID: ${task.id}] "${task.title}" | ${task.priority} | ${estimate} | ${actual} | completed ${new Date(task.updatedAt).toLocaleDateString()}`);
      }
    }
    if (ctx.availableHoursTonight) {
      lines.push(`Available Time Tonight: ${ctx.availableHoursTonight} hours`);
    }

    if (ctx.projects.length > 0) {
      lines.push(`\nProjects (${ctx.projects.length}):`);
      for (const p of ctx.projects) {
        lines.push(`- [ID: ${p.id}] "${p.name}": ${p.completedTasks}/${p.totalTasks} tasks done`);
      }
    }

    if (ctx.activeTasks.length > 0) {
      lines.push(`\nActive Unfinished Tasks:`);
      for (const t of ctx.activeTasks) {
        const deadlineStr = t.deadline
          ? `due ${new Date(t.deadline).toLocaleDateString()}`
          : "no deadline";
        const estStr = t.estimatedMinutes ? `${t.estimatedMinutes}m est` : "no est";
        const projStr = t.projectName ? `[Project: ${t.projectName}]` : "";
        const blockerStr =
          t.isBlocked && t.blockers && t.blockers.length > 0
            ? `(BLOCKED by: ${t.blockers.filter((b) => b.status !== "COMPLETED").map((b) => b.title).join(", ")})`
            : "(Not blocked)";
        const unblocksStr =
          t.unblocks && t.unblocks.length > 0
            ? `(Unblocks: ${t.unblocks.map((u) => u.title).join(", ")})`
            : "";

        lines.push(
          `- [ID: ${t.id}] "${t.title}" | Priority: ${t.priority} | Status: ${t.status} | ${estStr} | ${deadlineStr} ${projStr} | ${blockerStr} ${unblocksStr}`
        );
      }
    } else {
      lines.push(`\nActive Tasks: None currently.`);
    }

    if (ctx.recentFocusSessions && ctx.recentFocusSessions.length > 0) {
      lines.push(`\nRecent Focus Activity:`);
      for (const s of ctx.recentFocusSessions) {
        lines.push(
          `- "${s.taskTitle}": ${s.durationMinutes}m spent (planned ${s.plannedMinutes}m)`
        );
      }
    }

    lines.push(`=== END CONTEXT ===`);
    return lines.join("\n");
  }
}
