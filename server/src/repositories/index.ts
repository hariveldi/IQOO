import { prisma } from "./prisma";
import { CreateTaskInput, UpdateTaskInput, TaskStatus } from "@iqoo/shared";

function serializeTags(tags?: string[] | string) {
  if (Array.isArray(tags)) return JSON.stringify(tags);
  if (typeof tags === "string") return tags;
  return "[]";
}

function parseTags(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags as string[];
  if (typeof tags === "string") {
    try {
      const parsed = JSON.parse(tags);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return tags ? [tags] : [];
    }
  }
  return [];
}

function mapTask<T extends { tags?: unknown }>(task: T) {
  return { ...task, tags: parseTags(task.tags) };
}

export class TaskRepository {
  async create(userId: string, data: CreateTaskInput) {
    const { tags, dependencies, ...rest } = data;
    void dependencies;
    const task = await prisma.task.create({
      data: {
        userId,
        ...rest,
        tags: serializeTags(tags),
      },
    });
    return mapTask(task);
  }

  async findById(id: string, userId: string) {
    return prisma.task.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        reminders: true,
        focusSessions: true,
        dependsOn: {
          include: { toTask: true },
        },
        blockedBy: {
          include: { fromTask: true },
        },
      },
    });
    return task ? mapTask(task) : null;
  }

  async findByUserId(userId: string, options?: { projectId?: string; status?: TaskStatus }) {
    const tasks = await prisma.task.findMany({
      where: {
        userId,
        ...(options?.projectId && { projectId: options.projectId }),
        ...(options?.status && { status: options.status }),
      },
      include: {
        reminders: true,
        dependsOn: true,
        blockedBy: true,
      },
      orderBy: [{ priority: "desc" }, { deadline: "asc" }],
    });
    return tasks.map(mapTask);
  }

  async update(id: string, userId: string, data: UpdateTaskInput) {
    const { tags, dependencies, ...rest } = data;
    void dependencies;
    const task = await prisma.task.update({
      where: {
        id,
        userId,
      },
      data: {
        ...rest,
        ...(tags !== undefined ? { tags: serializeTags(tags) } : {}),
      },
      include: {
        reminders: true,
        dependsOn: true,
        blockedBy: true,
      },
    });
    return mapTask(task);
  }

  async delete(id: string, userId: string) {
    return prisma.task.delete({
      where: {
        id,
        userId,
      },
    });
  }

  async getTasksWithBlockers(userId: string) {
    const tasks = await prisma.task.findMany({
      where: { userId },
      include: {
        blockedBy: {
          include: { fromTask: true },
        },
      },
    });

    return tasks.map((task) => ({
      ...mapTask(task),
      isBlocked: task.blockedBy.some((dep) => dep.fromTask.status !== "COMPLETED"),
    }));
  }
}

export class ProjectRepository {
  async create(userId: string, data: { name: string; description?: string; color?: string }) {
    return prisma.project.create({
      data: {
        userId,
        ...data,
      },
    });
  }

  async findById(id: string, userId: string) {
    return prisma.project.findFirst({
      where: { id, userId },
      include: { tasks: true },
    });
  }

  async findByUserId(userId: string) {
    return prisma.project.findMany({
      where: { userId },
      include: {
        tasks: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });
  }

  async update(id: string, userId: string, data: any) {
    return prisma.project.update({
      where: { id, userId },
      data,
      include: { tasks: true },
    });
  }

  async delete(id: string, userId: string) {
    return prisma.project.delete({
      where: { id, userId },
    });
  }
}

export class ActionInboxRepository {
  async create(userId: string, data: any) {
    const { extractedData, ...rest } = data;
    return prisma.actionInboxItem.create({
      data: {
        userId,
        ...rest,
        extractedData:
          extractedData == null
            ? extractedData
            : typeof extractedData === "string"
              ? extractedData
              : JSON.stringify(extractedData),
      },
    });
  }

  async findByUserId(userId: string) {
    return prisma.actionInboxItem.findMany({
      where: { userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string, userId: string) {
    return prisma.actionInboxItem.findFirst({
      where: { id, userId },
    });
  }

  async update(id: string, userId: string, data: any) {
    return prisma.actionInboxItem.update({
      where: { id, userId },
      data,
    });
  }

  async delete(id: string, userId: string) {
    return prisma.actionInboxItem.delete({
      where: { id, userId },
    });
  }
}

export class ReminderRepository {
  async create(userId: string, taskId: string, data: any) {
    return prisma.reminder.create({
      data: {
        userId,
        taskId,
        ...data,
      },
    });
  }

  async findPendingReminders() {
    return prisma.reminder.findMany({
      where: {
        sent: false,
        reminderTime: {
          lte: new Date(),
        },
      },
      include: {
        task: true,
        user: true,
      },
    });
  }

  async markAsSent(id: string) {
    return prisma.reminder.update({
      where: { id },
      data: { sent: true },
    });
  }
}

export class UserRepository {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(data: { email: string; password: string; name: string }) {
    return prisma.user.create({
      data,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
