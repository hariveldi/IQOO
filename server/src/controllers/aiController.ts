import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { AIService, TaskService } from "../services";
import { AppError } from "../middleware/errorHandler";
import { AIAssistantRequestSchema, ExecuteAIActionsSchema } from "@iqoo/shared";
import { prisma } from "../repositories/prisma";
import { ActionExecutor } from "../ai/actions";

export interface OfficeKitLaptopSession {
  userId: string;
  deviceId: string;
  name: string;
  lastSeen: number;
  ip?: string;
}

// In-memory registry of active laptop connections per user
export const activeLaptopSessions = new Map<string, OfficeKitLaptopSession>();

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

  async processActionPipeline(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { text, image, mimeType, imageType, autoExecute } = req.body;
    if (!text && !image) {
      throw new AppError(400, "Either text instruction or image is required", "MISSING_INPUT");
    }

    const result = await this.aiService.processActionPipeline(req.userId, {
      text,
      image,
      mimeType,
      imageType,
      autoExecute: autoExecute !== undefined ? Boolean(autoExecute) : true,
    });

    res.json({
      success: true,
      data: result,
    });
  }

  async getOfficeKitFiles(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const documents = await prisma.document.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    res.json({
      success: true,
      data: { documents },
    });
  }

  async downloadOfficeKitFile(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { id } = req.params;
    const document = await prisma.document.findFirst({
      where: { id, userId: req.userId },
    });

    if (!document) {
      throw new AppError(404, "Document not found", "NOT_FOUND");
    }

    res.setHeader("Content-Disposition", `attachment; filename="${document.fileName}"`);
    res.setHeader("Content-Type", document.fileType || "text/plain");
    res.send(document.content || "");
  }

  async getWeeklyReview(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const review = await this.aiService.generateWeeklyReview(req.userId);
    res.json({
      success: true,
      data: review,
    });
  }

  async getOfficeKitStatus(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const session = activeLaptopSessions.get(req.userId);
    const now = Date.now();
    // Connected if heartbeat seen in last 60 seconds
    const isConnected = !!(session && now - session.lastSeen < 60000);

    const pendingCount = await prisma.document.count({
      where: {
        userId: req.userId,
        filePath: { startsWith: "officekit/" },
      },
    });

    res.json({
      success: true,
      data: {
        connected: isConnected,
        laptop: isConnected && session
          ? {
              deviceId: session.deviceId,
              name: session.name,
              lastSeen: new Date(session.lastSeen).toISOString(),
              ip: session.ip || "127.0.0.1",
            }
          : null,
        pendingDocumentsCount: pendingCount,
      },
    });
  }

  async connectLaptop(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const deviceName = req.body?.deviceName || "Office Kit Connected Laptop";
    const deviceId = req.body?.deviceId || `laptop_${Date.now()}`;

    const session: OfficeKitLaptopSession = {
      userId: req.userId,
      deviceId,
      name: deviceName,
      lastSeen: Date.now(),
      ip: req.ip,
    };

    activeLaptopSessions.set(req.userId, session);

    res.json({
      success: true,
      data: {
        connected: true,
        laptop: {
          deviceId: session.deviceId,
          name: session.name,
          lastSeen: new Date(session.lastSeen).toISOString(),
        },
      },
    });
  }

  async laptopHeartbeat(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    let session = activeLaptopSessions.get(req.userId);
    if (!session) {
      session = {
        userId: req.userId,
        deviceId: req.body?.deviceId || `laptop_${Date.now()}`,
        name: req.body?.deviceName || "Office Kit Connected Laptop",
        lastSeen: Date.now(),
        ip: req.ip,
      };
      activeLaptopSessions.set(req.userId, session);
    } else {
      session.lastSeen = Date.now();
    }

    res.json({
      success: true,
      data: {
        status: "alive",
        lastSeen: new Date(session.lastSeen).toISOString(),
      },
    });
  }

  async disconnectLaptop(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    activeLaptopSessions.delete(req.userId);

    res.json({
      success: true,
      data: {
        connected: false,
      },
    });
  }

  async transferTaskToLaptop(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const session = activeLaptopSessions.get(req.userId);
    const now = Date.now();
    const isConnected = !!(session && now - session.lastSeen < 60000);

    if (!isConnected || !session) {
      throw new AppError(
        400,
        "Laptop not connected via Office Kit. Please connect your laptop companion to enable sync.",
        "LAPTOP_NOT_CONNECTED"
      );
    }

    const { taskId, title, description, priority, deadline, status } = req.body || {};

    let task = null;
    if (taskId) {
      task = await prisma.task.findFirst({
        where: { id: taskId, userId: req.userId },
      });
    }

    const taskTitle = task?.title || title || "Untitled Task";
    const taskPriority = task?.priority || priority || "MEDIUM";
    const taskDescription = task?.description || description || "";
    const taskDeadline = task?.deadline ? new Date(task.deadline).toISOString() : deadline || null;
    const taskStatus = task?.status || status || "TODO";

    const fileName = `officekit_task_${(task?.id || Date.now()).toString().slice(-6)}_${taskTitle
      .replace(/[^\w]/g, "_")
      .slice(0, 30)}.md`;

    const payloadContent = [
      `# Office Kit Task Sync`,
      `**Task**: ${taskTitle}`,
      `**Priority**: ${taskPriority}`,
      taskDeadline ? `**Deadline**: ${taskDeadline}` : null,
      `**Status**: ${taskStatus}`,
      `**Transferred At**: ${new Date().toISOString()}`,
      `**Source**: iQOO Ambient AI Engine`,
      `**Target Laptop**: ${session.name}`,
      ``,
      `## Description`,
      taskDescription || "No additional description provided.",
      ``,
      `---`,
      `*Synchronized seamlessly from iQOO Phone to ${session.name} via iQOO Office Kit.*`,
    ]
      .filter(Boolean)
      .join("\n");

    const results = await ActionExecutor.executeBatch(req.userId, [
      {
        type: "SEND_TO_LAPTOP",
        description: `Transfer task "${taskTitle}" to ${session.name}`,
        data: {
          fileName,
          fileType: "text/markdown",
          payload: payloadContent,
          summary: `Office Kit: Transferred task "${taskTitle}" to ${session.name}`,
          destination: session.name,
          task: {
            id: task?.id || taskId,
            title: taskTitle,
            priority: taskPriority,
            deadline: taskDeadline,
            status: taskStatus,
          },
        },
      },
    ]);

    const execResult = results[0];

    if (!execResult || !execResult.success) {
      throw new AppError(
        500,
        execResult?.error || "Failed to transfer task to laptop",
        "TRANSFER_FAILED"
      );
    }

    res.json({
      success: true,
      data: {
        transferred: true,
        laptopName: session.name,
        result: execResult.result,
      },
    });
  }
}


