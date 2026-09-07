import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { AIService, TaskService } from "../services";
import { AppError } from "../middleware/errorHandler";
import { AIAssistantRequestSchema } from "@iqoo/shared";

export class AIController {
  constructor(private aiService: AIService, private taskService: TaskService) {}

  async extractFromVoice(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { transcript } = req.body;
    if (!transcript) {
      throw new AppError(400, "Transcript is required", "MISSING_TRANSCRIPT");
    }

    const extracted = await this.aiService.extractTaskFromVoice(transcript);

    res.json({
      success: true,
      data: { extracted },
    });
  }

  async extractFromImage(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { imageBase64, imageType } = req.body;
    if (!imageBase64) {
      throw new AppError(400, "Image data is required", "MISSING_IMAGE");
    }

    const extracted = await this.aiService.extractFromImage(imageBase64, imageType);

    res.json({
      success: true,
      data: { extracted },
    });
  }

  async extractFromDocument(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { documentContent, fileName } = req.body;
    if (!documentContent || !fileName) {
      throw new AppError(400, "Document content and filename are required", "MISSING_DOCUMENT");
    }

    const extracted = await this.aiService.extractFromDocument(documentContent, fileName);

    res.json({
      success: true,
      data: { extracted },
    });
  }

  async getRecommendation(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const tasks = await this.taskService.getTasks(req.userId);
    const completedTasks = tasks.filter((t: any) => t.status === "COMPLETED").length;
    const pendingTasks = tasks.filter((t: any) => t.status !== "COMPLETED").length;
    const overdueTasks = tasks.filter(
      (t: any) => t.deadline && new Date(t.deadline) < new Date()
    ).length;
    const highPriorityTasks = tasks.filter(
      (t: any) => (t.priority === "CRITICAL" || t.priority === "HIGH") && t.status !== "COMPLETED"
    ).length;

    const recommendation = await this.aiService.getRecommendation({
      completedTasks,
      pendingTasks,
      overdueTasks,
      highPriorityTasks,
    });

    res.json({
      success: true,
      data: { recommendation },
    });
  }

  async chat(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const input = AIAssistantRequestSchema.parse(req.body);
    const tasks = await this.taskService.getTasks(req.userId);

    const context = {
      taskCount: tasks.length,
      completedCount: tasks.filter((t: any) => t.status === "COMPLETED").length,
      ...input.context,
    };

    const response = await this.aiService.chat(input.message, context);

    res.json({
      success: true,
      data: { response },
    });
  }
}
