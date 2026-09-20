import { prisma } from "../repositories/prisma";
import { AIAction, TaskStatus, TaskPriority } from "@iqoo/shared";
import { logger } from "../config/logger";
import { z } from "zod";

export interface ActionExecutionResult {
  action: AIAction;
  success: boolean;
  result?: any;
  error?: string;
}

export class ActionExecutor {
  /**
   * Executes a batch of user-confirmed AI actions in the database.
   */
  static async executeBatch(
    userId: string,
    actions: AIAction[]
  ): Promise<ActionExecutionResult[]> {
    const results: ActionExecutionResult[] = [];
    // Map temporary placeholder IDs to created real database IDs (e.g., if a plan created project then tasks)
    const idMap: Map<string, string> = new Map();

    for (const action of actions) {
      try {
        ActionExecutor.validateAction(action);
        const result = await ActionExecutor.executeSingle(userId, action, idMap);
        results.push({
          action,
          success: true,
          result,
        });
      } catch (err: any) {
        logger.error(`Failed to execute AI action ${action.type}:`, err);
        results.push({
          action,
          success: false,
          error: err?.message || "Action execution failed",
        });
      }
    }

    return results;
  }

  private static validateAction(action: AIAction) {
    if (!action || typeof action.description !== "string" || action.description.length > 500) {
      throw new Error("AI action description is invalid");
    }

    const data = action.data || {};
    switch (action.type) {
      case "CREATE_PROJECT":
        z.object({ name: z.string().min(1).max(255), description: z.string().max(5000).optional(), color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(), tempId: z.string().max(100).optional() }).parse(data);
        break;
      case "CREATE_TASK":
        z.object({ title: z.string().min(1).max(255), description: z.string().max(10000).optional(), priority: z.nativeEnum(TaskPriority).optional(), status: z.nativeEnum(TaskStatus).optional(), estimatedMinutes: z.number().int().min(1).max(1440).optional(), deadline: z.string().datetime().optional(), projectId: z.string().max(100).optional(), tempId: z.string().max(100).optional(), tags: z.array(z.string().max(50)).max(30).optional(), dependencies: z.array(z.string().max(100)).max(50).optional() }).parse(data);
        break;
      case "UPDATE_TASK":
        z.object({ taskId: z.string().min(1).max(100), title: z.string().min(1).max(255).optional(), description: z.string().max(10000).optional(), status: z.nativeEnum(TaskStatus).optional(), priority: z.nativeEnum(TaskPriority).optional(), estimatedMinutes: z.number().int().min(1).max(1440).optional(), actualMinutes: z.number().int().min(0).max(100000).optional(), deadline: z.string().datetime().nullable().optional(), projectId: z.string().max(100).nullable().optional() }).parse(data);
        break;
      case "DELETE_TASK":
        z.object({ taskId: z.string().min(1).max(100) }).parse(data);
        break;
      case "CREATE_DEPENDENCY":
      case "DELETE_DEPENDENCY":
        z.object({ fromTaskId: z.string().min(1).max(100), toTaskId: z.string().min(1).max(100) }).parse(data);
        break;
      case "SCHEDULE_PLAN":
        z.object({ date: z.string().datetime(), blocks: z.array(z.object({ taskId: z.string().min(1).max(100), startTime: z.string().datetime().optional(), endTime: z.string().datetime().optional(), durationMinutes: z.number().int().min(1).max(1440).optional(), reason: z.string().max(500).optional() })).max(50) }).parse(data);
        break;
      default:
        throw new Error(`Unknown action type: ${(action as any).type}`);
    }
  }

  private static async executeSingle(
    userId: string,
    action: AIAction,
    idMap: Map<string, string>
  ) {
    const data = action.data || {};

    switch (action.type) {
      case "CREATE_PROJECT": {
        const project = await prisma.project.create({
          data: {
            userId,
            name: data.name || "New Project",
            description: data.description,
            color: data.color || "#3B82F6",
          },
        });
        if (data.tempId) {
          idMap.set(data.tempId, project.id);
        }
        return project;
      }

      case "CREATE_TASK": {
        let projectId = data.projectId;
        if (projectId && idMap.has(projectId)) {
          projectId = idMap.get(projectId);
        }

        let deadline: Date | undefined = undefined;
        if (data.deadline) {
          const d = new Date(data.deadline);
          if (!isNaN(d.getTime())) deadline = d;
        }

        if (projectId) {
          const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
          if (!project) throw new Error("Project is not owned by the authenticated user");
        }

        const task = await prisma.task.create({
          data: {
            userId,
            title: data.title || "Untitled Task",
            description: data.description,
            status: data.status || TaskStatus.TODO,
            priority: data.priority || TaskPriority.MEDIUM,
            deadline,
            estimatedMinutes: data.estimatedMinutes ? Number(data.estimatedMinutes) : null,
            projectId: projectId || null,
            tags: JSON.stringify(Array.isArray(data.tags) ? data.tags : []),
          },
        });

        if (data.tempId) {
          idMap.set(data.tempId, task.id);
        }

        // Link dependencies if provided in task data
        if (Array.isArray(data.dependencies) && data.dependencies.length > 0) {
          for (const depId of data.dependencies) {
            const realFromId = idMap.get(depId) || depId;
            // Check that prerequisite task exists and belongs to user
            const fromTask = await prisma.task.findFirst({
              where: { id: realFromId, userId },
            });
            if (fromTask && fromTask.id !== task.id) {
              await prisma.taskDependency.upsert({
                where: {
                  fromTaskId_toTaskId: {
                    fromTaskId: fromTask.id,
                    toTaskId: task.id,
                  },
                },
                update: {},
                create: {
                  fromTaskId: fromTask.id,
                  toTaskId: task.id,
                },
              }).catch(() => {});
            }
          }
        }

        return task;
      }

      case "UPDATE_TASK": {
        const taskId = idMap.get(data.taskId) || data.taskId || data.id;
        if (!taskId) throw new Error("Missing taskId for UPDATE_TASK");

        const updateData: any = {};
        if (data.title !== undefined) updateData.title = data.title;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.priority !== undefined) updateData.priority = data.priority;
        if (data.estimatedMinutes !== undefined)
          updateData.estimatedMinutes = Number(data.estimatedMinutes);
        if (data.actualMinutes !== undefined)
          updateData.actualMinutes = Number(data.actualMinutes);
        if (data.deadline !== undefined) {
          const d = new Date(data.deadline);
          updateData.deadline = isNaN(d.getTime()) ? null : d;
        }
        if (data.projectId !== undefined) {
          updateData.projectId = idMap.get(data.projectId) || data.projectId;
          if (updateData.projectId) {
            const project = await prisma.project.findFirst({ where: { id: updateData.projectId, userId } });
            if (!project) throw new Error("Project is not owned by the authenticated user");
          }
        }

        const task = await prisma.task.update({
          where: { id: taskId, userId },
          data: updateData,
        });
        return task;
      }

      case "DELETE_TASK": {
        const taskId = idMap.get(data.taskId) || data.taskId || data.id;
        if (!taskId) throw new Error("Missing taskId for DELETE_TASK");

        return prisma.task.delete({
          where: { id: taskId, userId },
        });
      }

      case "CREATE_DEPENDENCY": {
        const fromTaskId = idMap.get(data.fromTaskId) || data.fromTaskId;
        const toTaskId = idMap.get(data.toTaskId) || data.toTaskId;

        if (!fromTaskId || !toTaskId) {
          throw new Error("Missing fromTaskId or toTaskId for CREATE_DEPENDENCY");
        }

        const [fromTask, toTask] = await Promise.all([
          prisma.task.findFirst({ where: { id: fromTaskId, userId } }),
          prisma.task.findFirst({ where: { id: toTaskId, userId } }),
        ]);

        if (!fromTask || !toTask) {
          throw new Error("Tasks for dependency not found");
        }

        return prisma.taskDependency.upsert({
          where: {
            fromTaskId_toTaskId: {
              fromTaskId,
              toTaskId,
            },
          },
          update: {},
          create: {
            fromTaskId,
            toTaskId,
          },
        });
      }

      case "DELETE_DEPENDENCY": {
        const fromTaskId = idMap.get(data.fromTaskId) || data.fromTaskId;
        const toTaskId = idMap.get(data.toTaskId) || data.toTaskId;

        if (!fromTaskId || !toTaskId) {
          throw new Error("Missing fromTaskId or toTaskId for DELETE_DEPENDENCY");
        }

        const dep = await prisma.taskDependency.findFirst({
          where: {
            fromTaskId,
            toTaskId,
            fromTask: { userId },
          },
        });

        if (dep) {
          return prisma.taskDependency.delete({
            where: { id: dep.id },
          });
        }
        return { deleted: false };
      }

      case "SCHEDULE_PLAN": {
        const planDate = data.date ? new Date(data.date) : new Date();
        const startOfDay = new Date(planDate);
        startOfDay.setHours(0, 0, 0, 0);

        const blocks = data.blocks || [];
        const totalMinutes = blocks.reduce(
          (sum: number, b: any) => sum + (Number(b.durationMinutes) || 45),
          0
        );

        return prisma.dailyPlan.upsert({
          where: {
            userId_date: {
              userId,
              date: startOfDay,
            },
          },
          update: {
            blocks: JSON.stringify(blocks),
            totalMinutes,
          },
          create: {
            userId,
            date: startOfDay,
            blocks: JSON.stringify(blocks),
            totalMinutes,
          },
        });
      }

      default:
        throw new Error(`Unknown action type: ${(action as any).type}`);
    }
  }
}
