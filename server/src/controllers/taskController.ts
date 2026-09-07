import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { TaskService } from "../services";
import { CreateTaskSchema, UpdateTaskSchema } from "@iqoo/shared";
import { AppError } from "../middleware/errorHandler";

export class TaskController {
  constructor(private taskService: TaskService) {}

  async createTask(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const input = CreateTaskSchema.parse(req.body);
    const task = await this.taskService.createTask(req.userId, input);

    res.status(201).json({
      success: true,
      data: { task },
    });
  }

  async getTask(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { id } = req.params;
    const task = await this.taskService.getTask(id, req.userId);

    if (!task) {
      throw new AppError(404, "Task not found", "TASK_NOT_FOUND");
    }

    res.json({
      success: true,
      data: { task },
    });
  }

  async listTasks(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { projectId, status } = req.query;
    const tasks = await this.taskService.getTasks(req.userId, {
      projectId: projectId as string,
      status: status as any,
    });

    res.json({
      success: true,
      data: { tasks },
    });
  }

  async updateTask(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { id } = req.params;
    const input = UpdateTaskSchema.parse(req.body);
    const task = await this.taskService.updateTask(id, req.userId, input);

    res.json({
      success: true,
      data: { task },
    });
  }

  async deleteTask(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { id } = req.params;
    await this.taskService.deleteTask(id, req.userId);

    res.json({
      success: true,
      message: "Task deleted",
    });
  }

  async completeTask(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { id } = req.params;
    const { actualMinutes } = req.body;
    const task = await this.taskService.completeTask(id, req.userId, actualMinutes);

    res.json({
      success: true,
      data: { task },
    });
  }
}
