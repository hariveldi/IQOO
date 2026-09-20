import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { AIService, TaskService } from "../services";
import { AppError } from "../middleware/errorHandler";
import { AIAssistantRequestSchema, ExecuteAIActionsSchema } from "@iqoo/shared";

export class AIController {
  constructor(private aiService: AIService, _taskService?: TaskService) {}

  async getStatus(_req: AuthRequest, res: Response) {
    const status = this.aiService.getProviderStatus();
    res.json({
      success: true,
      data: status,
    });
  }

  async extractFromVoice(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { transcript } = req.body;
    if (!transcript) {
      throw new AppError(400, "Transcript is required", "MISSING_TRANSCRIPT");
    }

    const extracted = await this.aiService.extractTaskFromVoice(req.userId, transcript);

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

    const extracted = await this.aiService.extractFromImage(req.userId, imageBase64, imageType);

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

    const extracted = await this.aiService.extractFromDocument(req.userId, documentContent, fileName);

    res.json({
      success: true,
      data: { extracted },
    });
  }

  async getRecommendation(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const result = await this.aiService.getSmartRecommendation(req.userId);
    res.json({
      success: true,
      data: result,
    });
  }

  async getInsights(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const insights = await this.aiService.getPersonalizedInsights(req.userId);
    res.json({
      success: true,
      data: { insights },
    });
  }

  async chat(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const input = AIAssistantRequestSchema.parse(req.body);
    const history = Array.isArray(req.body.history) ? req.body.history : [];

    const result = await this.aiService.chat(req.userId, input.message, history);

    res.json({
      success: true,
      data: result,
    });
  }

  async extractPlanFromText(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      throw new AppError(400, "Text is required for plan extraction", "MISSING_TEXT");
    }
    const plan = await this.aiService.extractPlanFromText(req.userId, text);
    res.json({ success: true, data: { plan } });
  }

  async executeActions(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { actions } = ExecuteAIActionsSchema.parse(req.body);
    const results = await this.aiService.executeActions(req.userId, actions);

    res.json({
      success: true,
      data: { results },
    });
  }

  async breakdownTask(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { title, description } = req.body;
    if (!title || typeof title !== "string") {
      throw new AppError(400, "Task title is required", "MISSING_TITLE");
    }

    const breakdown = await this.aiService.breakdownTask(req.userId, title, description);
    res.json({
      success: true,
      data: breakdown,
    });
  }

  async estimateDuration(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { title, description } = req.body;
    if (!title || typeof title !== "string") {
      throw new AppError(400, "Task title is required", "MISSING_TITLE");
    }

    const estimation = await this.aiService.estimateDuration(req.userId, title, description);
    res.json({
      success: true,
      data: estimation,
    });
  }

  async getProjectReview(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { projectId } = req.params;
    const { name, tasks } = req.body;
    const review = await this.aiService.generateProjectReview(
      req.userId,
      projectId,
      name || "Project",
      Array.isArray(tasks) ? tasks : []
    );

    res.json({
      success: true,
      data: review,
    });
  }

  async getDailyBriefing(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const briefing = await this.aiService.generateDailyBriefing(req.userId);
    res.json({
      success: true,
      data: briefing,
    });
  }

  async getWeeklyReview(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const review = await this.aiService.generateWeeklyReview(req.userId);
    res.json({
      success: true,
      data: review,
    });
  }
}


