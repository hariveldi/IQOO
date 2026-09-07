import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { ActionInboxController } from "../controllers/actionInboxController";
import { ActionInboxService, AIService, TaskService } from "../services";
import { ActionInboxRepository, TaskRepository } from "../repositories";
import { AIProviderFactory } from "../ai/provider";
import { config } from "../config";

const router = Router();

const taskRepo = new TaskRepository();
const taskService = new TaskService(taskRepo);
const inboxRepo = new ActionInboxRepository();
const inboxService = new ActionInboxService(inboxRepo, taskService);

const aiProvider = AIProviderFactory.create(config.ai.provider);
const aiService = new AIService(aiProvider);

const inboxController = new ActionInboxController(inboxService, aiService);

// Action Inbox routes
router.get("/", authenticateToken, (req, res, next) => {
  inboxController.getInbox(req, res).catch(next);
});

router.post("/voice", authenticateToken, (req, res, next) => {
  inboxController.captureVoice(req, res).catch(next);
});

router.post("/image", authenticateToken, (req, res, next) => {
  inboxController.captureImage(req, res).catch(next);
});

router.post("/:id/accept", authenticateToken, (req, res, next) => {
  inboxController.acceptItem(req, res).catch(next);
});

router.post("/:id/reject", authenticateToken, (req, res, next) => {
  inboxController.rejectItem(req, res).catch(next);
});

router.post("/:id/convert", authenticateToken, (req, res, next) => {
  inboxController.convertToTask(req, res).catch(next);
});

export default router;
