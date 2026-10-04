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
    if (!action || (action.description && typeof action.description !== "string")) {
      throw new Error("AI action description is invalid");
    }

    const normalizedType = (action.type || "").toString().toUpperCase();
    const data = action.data || {};

    switch (normalizedType) {
      case "CREATE_PROJECT":
        z.object({ name: z.string().min(1).max(255), description: z.string().max(5000).optional(), color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(), tempId: z.string().max(100).optional() }).parse(data);
        break;
      case "CREATE_TASK":
        z.object({ title: z.string().min(1).max(255), description: z.string().max(10000).optional(), priority: z.nativeEnum(TaskPriority).or(z.string()).optional(), status: z.nativeEnum(TaskStatus).or(z.string()).optional(), estimatedMinutes: z.number().int().min(1).max(1440).optional(), deadline: z.string().optional(), projectId: z.string().max(100).optional(), tempId: z.string().max(100).optional(), tags: z.array(z.string().max(50)).max(30).optional(), dependencies: z.array(z.string().max(100)).max(50).optional() }).parse(data);
        break;
      case "UPDATE_TASK":
        z.object({ taskId: z.string().min(1).max(100).optional(), id: z.string().min(1).max(100).optional(), title: z.string().min(1).max(255).optional(), description: z.string().max(10000).optional(), status: z.nativeEnum(TaskStatus).or(z.string()).optional(), priority: z.nativeEnum(TaskPriority).or(z.string()).optional(), estimatedMinutes: z.number().int().min(1).max(1440).optional(), actualMinutes: z.number().int().min(0).max(100000).optional(), deadline: z.string().nullable().optional(), projectId: z.string().max(100).nullable().optional() }).parse(data);
        break;
      case "DELETE_TASK":
        z.object({ taskId: z.string().min(1).max(100).optional(), id: z.string().min(1).max(100).optional() }).parse(data);
        break;
      case "CREATE_DEPENDENCY":
      case "DELETE_DEPENDENCY":
        z.object({ fromTaskId: z.string().min(1).max(100), toTaskId: z.string().min(1).max(100) }).parse(data);
        break;
      case "SCHEDULE_PLAN":
        z.object({ date: z.string().optional(), blocks: z.array(z.object({ taskId: z.string().min(1).max(100).optional(), startTime: z.string().optional(), endTime: z.string().optional(), durationMinutes: z.number().int().min(1).max(1440).optional(), reason: z.string().max(500).optional() })).max(50).optional() }).parse(data);
        break;
      case "CREATE_CSV":
      case "CREATE_REPORT":
      case "SAVE_NOTE":
      case "SEND_TO_LAPTOP":
      case "SUMMARIZE":
      case "EXTRACT_INFORMATION":
        // General safe validation for content and document actions
        break;
      default:
        logger.warn(`Unchecked action type: ${action.type}, attempting execution`);
        break;
    }
  }

  private static async executeSingle(
    userId: string,
    action: AIAction,
    idMap: Map<string, string>
  ) {
    const normalizedType = (action.type || "").toString().toUpperCase();
    const data = action.data || {};

    switch (normalizedType) {
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

        let priority = TaskPriority.MEDIUM;
        if (data.priority) {
          const p = data.priority.toString().toUpperCase();
          if (p in TaskPriority) {
            priority = (TaskPriority as any)[p];
          }
        }

        let status = TaskStatus.TODO;
        if (data.status) {
          const s = data.status.toString().toUpperCase();
          if (s in TaskStatus) {
            status = (TaskStatus as any)[s];
          }
        }

        if (projectId) {
          const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
          if (!project) throw new Error("Project is not owned by the authenticated user");
        }

        const task = await prisma.task.create({
          data: {
            userId,
            title: data.title || action.description || "Untitled Task",
            description: data.description || "",
            status,
            priority,
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
        if (data.status !== undefined) {
          const s = data.status.toString().toUpperCase();
          updateData.status = s in TaskStatus ? (TaskStatus as any)[s] : data.status;
        }
        if (data.priority !== undefined) {
          const p = data.priority.toString().toUpperCase();
          updateData.priority = p in TaskPriority ? (TaskPriority as any)[p] : data.priority;
        }
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

      case "SAVE_NOTE": {
        const title = data.title || (action.description ? action.description.slice(0, 80) : "AI Generated Note");
        const content = data.content || data.description || (data.fields ? JSON.stringify(data.fields, null, 2) : "");
        const tags = Array.isArray(data.tags) ? data.tags : ["ai_note", "phone_captured"];

        const note = await prisma.note.create({
          data: {
            userId,
            title,
            content,
            tags: JSON.stringify(tags),
          },
        });
        return note;
      }

      case "CREATE_CSV": {
        let csvContent = data.csvContent;
        if (!csvContent && Array.isArray(data.rows) && Array.isArray(data.columns)) {
          const header = data.columns.map((c: string) => `"${String(c).replace(/"/g, '""')}"`).join(",");
          const rows = data.rows.map((r: any[]) =>
            r.map((cell: any) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
          );
          csvContent = [header, ...rows].join("\n");
        } else if (!csvContent && data.fields && typeof data.fields === "object") {
          const headers = Object.keys(data.fields).map((k) => `"${k.replace(/"/g, '""')}"`).join(",");
          const values = Object.values(data.fields).map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
          csvContent = `${headers}\n${values}`;
        } else if (!csvContent) {
          csvContent = "Field,Value\n" + Object.entries(data).map(([k, v]) => `"${k}","${String(v)}"`).join("\n");
        }

        const fileName = (data.fileName || `extracted_${Date.now()}.csv`).replace(/[^\w.-]/g, "_");
        const fileSize = Buffer.byteLength(csvContent, "utf8");

        const document = await prisma.document.create({
          data: {
            userId,
            fileName,
            fileType: "text/csv",
            fileSize,
            filePath: `generated/${fileName}`,
            content: csvContent,
            summary: data.summary || action.description || "Extracted structured CSV data",
          },
        });

        return {
          document,
          file: {
            name: fileName,
            type: "text/csv",
            content: csvContent,
            size: fileSize,
          },
        };
      }

      case "CREATE_REPORT": {
        const title = data.title || "AI Executive Report";
        let content = data.content || data.markdown || "";
        if (!content) {
          content = `# ${title}\n\n` +
            `**Generated**: ${new Date().toLocaleString()}\n\n` +
            `## Summary\n${data.summary || action.description || "Executive Summary"}\n\n` +
            (data.keyPoints ? `## Key Takeaways\n${(data.keyPoints as string[]).map((p) => `- ${p}`).join("\n")}\n\n` : "") +
            (data.fields ? `## Extracted Details\n${Object.entries(data.fields).map(([k, v]) => `- **${k}**: ${v}`).join("\n")}\n\n` : "") +
            (data.actionItems ? `## Action Items\n${(data.actionItems as string[]).map((a) => `- [ ] ${a}`).join("\n")}\n` : "");
        }

        const fileName = (data.fileName || `report_${Date.now()}.md`).replace(/[^\w.-]/g, "_");
        const fileSize = Buffer.byteLength(content, "utf8");

        const [document, note] = await Promise.all([
          prisma.document.create({
            data: {
              userId,
              fileName,
              fileType: "text/markdown",
              fileSize,
              filePath: `generated/${fileName}`,
              content,
              summary: data.summary || title,
            },
          }),
          prisma.note.create({
            data: {
              userId,
              title,
              content,
              tags: JSON.stringify(["ai_report", "office_kit"]),
            },
          }),
        ]);

        return {
          document,
          note,
          file: {
            name: fileName,
            type: "text/markdown",
            content,
            size: fileSize,
          },
        };
      }

      case "SEND_TO_LAPTOP": {
        const payloadContent = data.payload || data.content || data.csvContent || JSON.stringify(data, null, 2);
        const fileName = (data.fileName || `laptop_sync_${Date.now()}.txt`).replace(/[^\w.-]/g, "_");
        const fileSize = Buffer.byteLength(payloadContent, "utf8");

        const document = await prisma.document.create({
          data: {
            userId,
            fileName,
            fileType: data.fileType || "text/plain",
            fileSize,
            filePath: `officekit/${fileName}`,
            content: payloadContent,
            summary: data.summary || "Office Kit: Ready for Laptop Sync",
          },
        });

        return {
          document,
          officeKitSync: {
            synced: true,
            fileName,
            destination: data.destination || "Laptop (Office Kit)",
            timestamp: new Date().toISOString(),
          },
          file: {
            name: fileName,
            type: data.fileType || "text/plain",
            content: payloadContent,
            size: fileSize,
          },
        };
      }

      case "SUMMARIZE":
      case "EXTRACT_INFORMATION": {
        const title = data.title || `${normalizedType === "SUMMARIZE" ? "Summary" : "Extraction"}: ${new Date().toLocaleTimeString()}`;
        const content = data.summary || data.description || JSON.stringify(data.fields || data, null, 2);

        const note = await prisma.note.create({
          data: {
            userId,
            title,
            content,
            tags: JSON.stringify(["ai_extracted", normalizedType.toLowerCase()]),
          },
        });

        return {
          note,
          extractedData: data,
        };
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
        logger.warn(`Unhandled action type: ${(action as any).type}`);
        return { executed: true, data };
    }
  }
}
