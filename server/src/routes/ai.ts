import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { AIController } from "../controllers/aiController";
import { AIService, TaskService } from "../services";
import { TaskRepository } from "../repositories";
import { AIProviderFactory } from "../ai/provider";
import { config } from "../config";

const router = Router();

const taskRepo = new TaskRepository();
const taskService = new TaskService(taskRepo);
const aiProvider = AIProviderFactory.create(config.ai.provider);
const aiService = new AIService(aiProvider);
const aiController = new AIController(aiService, taskService);

// AI Extraction routes
router.post("/extract/voice", authenticateToken, (req, res, next) => {
  aiController.extractFromVoice(req, res).catch(next);
});

router.post("/extract/image", authenticateToken, (req, res, next) => {
  aiController.extractFromImage(req, res).catch(next);
});

router.post("/extract/document", authenticateToken, (req, res, next) => {
  aiController.extractFromDocument(req, res).catch(next);
});

// AI Recommendation
router.get("/recommendation", authenticateToken, (req, res, next) => {
  aiController.getRecommendation(req, res).catch(next);
});

// AI Chat
router.post("/chat", authenticateToken, (req, res, next) => {
  aiController.chat(req, res).catch(next);
});

export default router;
