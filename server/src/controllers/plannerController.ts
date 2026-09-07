import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { AIService, TaskService } from "../services";
import { AppError } from "../middleware/errorHandler";
import { prisma } from "../repositories/prisma";

export class PlannerController {
  constructor(private aiService: AIService, private taskService: TaskService) {}

  async generateDailyPlan(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { date, availableHoursPerDay = 8 } = req.body;
    const planDate = date ? new Date(date) : new Date();

    // Get all user tasks
    const tasks = await this.taskService.getTasks(req.userId);

    // Generate schedule
    const blocks = await this.aiService.generateDailySchedule(tasks, {
      workStartTime: new Date(planDate.setHours(9, 0, 0, 0)),
      availableHoursPerDay,
    });

    // Save daily plan to database
    const dailyPlan = await prisma.dailyPlan.upsert({
      where: {
        userId_date: {
          userId: req.userId,
          date: new Date(planDate.setHours(0, 0, 0, 0)),
        },
      },
      update: {
        blocks: JSON.stringify(blocks),
        totalMinutes: blocks.reduce(
          (sum: number, b: any) =>
            sum + (b.endTime.getTime() - b.startTime.getTime()) / (1000 * 60),
          0
        ),
      },
      create: {
        userId: req.userId,
        date: new Date(planDate.setHours(0, 0, 0, 0)),
        blocks: JSON.stringify(blocks),
        totalMinutes: blocks.reduce(
          (sum: number, b: any) =>
            sum + (b.endTime.getTime() - b.startTime.getTime()) / (1000 * 60),
          0
        ),
      },
    });

    res.json({
      success: true,
      data: { dailyPlan, blocks },
    });
  }

  async getDailyPlan(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { date } = req.query;
    const planDate = date ? new Date(date as string) : new Date();

    const dailyPlan = await prisma.dailyPlan.findFirst({
      where: {
        userId: req.userId,
        date: {
          gte: new Date(planDate.setHours(0, 0, 0, 0)),
          lt: new Date(planDate.setHours(24, 0, 0, 0)),
        },
      },
    });

    if (!dailyPlan) {
      throw new AppError(404, "Daily plan not found", "NOT_FOUND");
    }

    res.json({
      success: true,
      data: {
        dailyPlan,
        blocks: JSON.parse(dailyPlan.blocks as string),
      },
    });
  }

  async rescheduleAfterTaskCompletion(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { taskId, actualMinutes, date } = req.body;
    if (!taskId || actualMinutes === undefined) {
      throw new AppError(
        400,
        "Task ID and actual minutes are required",
        "MISSING_PARAMS"
      );
    }

    const planDate = date ? new Date(date) : new Date();
    const dailyPlan = await prisma.dailyPlan.findFirst({
      where: {
        userId: req.userId,
        date: {
          gte: new Date(planDate.setHours(0, 0, 0, 0)),
          lt: new Date(planDate.setHours(24, 0, 0, 0)),
        },
      },
    });

    if (!dailyPlan) {
      throw new AppError(404, "Daily plan not found", "NOT_FOUND");
    }

    const blocks = JSON.parse(dailyPlan.blocks as string);
    
    // Find and remove completed task
    const completedBlockIndex = blocks.findIndex((b: any) => b.taskId === taskId);
    if (completedBlockIndex === -1) {
      throw new AppError(404, "Task not found in daily plan", "TASK_NOT_FOUND");
    }

    blocks.splice(completedBlockIndex, 1);

    // Update daily plan
    const updatedPlan = await prisma.dailyPlan.update({
      where: { id: dailyPlan.id },
      data: {
        blocks: JSON.stringify(blocks),
        totalMinutes: blocks.reduce(
          (sum: number, b: any) =>
            sum + (b.endTime.getTime() - b.startTime.getTime()) / (1000 * 60),
          0
        ),
      },
    });

    res.json({
      success: true,
      data: {
        dailyPlan: updatedPlan,
        blocks: JSON.parse(updatedPlan.blocks as string),
      },
    });
  }

  async getWeeklyPlan(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { startDate } = req.query;
    const weekStart = startDate ? new Date(startDate as string) : new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Get Sunday

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const plans = await prisma.dailyPlan.findMany({
      where: {
        userId: req.userId,
        date: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
      orderBy: { date: "asc" },
    });

    res.json({
      success: true,
      data: {
        weekStart,
        weekEnd,
        plans: plans.map((p) => ({
          ...p,
          blocks: JSON.parse(p.blocks as string),
        })),
      },
    });
  }
}
