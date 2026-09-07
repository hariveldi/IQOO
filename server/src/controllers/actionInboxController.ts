import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { ActionInboxService, AIService } from "../services";
import { CreateActionInboxSchema, CreateTaskSchema } from "@iqoo/shared";
import { AppError } from "../middleware/errorHandler";

export class ActionInboxController {
  constructor(private inboxService: ActionInboxService, private aiService: AIService) {}

  async captureVoice(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { transcript } = req.body;
    if (!transcript) {
      throw new AppError(400, "Transcript is required", "MISSING_TRANSCRIPT");
    }

    // Extract structured data from voice
    const extractedData = await this.aiService.extractTaskFromVoice(transcript);

    // Create action inbox item
    const item = await this.inboxService.captureItem(req.userId, {
      type: "TASK",
      source: "VOICE",
      rawContent: transcript,
      extractedData,
    });

    res.status(201).json({
      success: true,
      data: { item, extractedData },
    });
  }

  async captureImage(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { imageBase64, imageType } = req.body;
    if (!imageBase64 || !imageType) {
      throw new AppError(400, "Image data and type are required", "MISSING_IMAGE_DATA");
    }

    // Extract from image
    const extractedData = await this.aiService.extractFromImage(imageBase64);

    // Create action inbox item
    const item = await this.inboxService.captureItem(req.userId, {
      type: "TASK",
      source: "CAMERA",
      rawContent: imageType,
      extractedData,
    });

    res.status(201).json({
      success: true,
      data: { item, extractedData },
    });
  }

  async getInbox(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const items = await this.inboxService.getInboxItems(req.userId);

    res.json({
      success: true,
      data: { items },
    });
  }

  async acceptItem(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { id } = req.params;
    const item = await this.inboxService.acceptItem(req.userId, id);

    res.json({
      success: true,
      data: { item },
    });
  }

  async rejectItem(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { id } = req.params;
    const item = await this.inboxService.rejectItem(req.userId, id);

    res.json({
      success: true,
      data: { item },
    });
  }

  async convertToTask(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { id } = req.params;
    const taskData = CreateTaskSchema.parse(req.body);

    const task = await this.inboxService.convertToTask(req.userId, id, taskData);

    res.status(201).json({
      success: true,
      data: { task },
    });
  }
}
