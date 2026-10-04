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
const aiKey = config.ai.provider === "gemini" 
  ? config.ai.geminiKey 
  : config.ai.provider === "xkiro" 
  ? config.ai.xkiroKey 
  : config.ai.openaiKey;

const aiProvider = AIProviderFactory.create(
  config.ai.provider,
  aiKey,
  config.ai.model
);
const aiService = new AIService(aiProvider, taskService);
const aiController = new AIController(aiService, taskService);

// Universal Phone-First AI Action Pipeline
router.post("/action-pipeline", authenticateToken, (req, res, next) => {
  aiController.processActionPipeline(req, res).catch(next);
});

// Office Kit Laptop Sync & Files
router.get("/office-kit/status", authenticateToken, (req, res, next) => {
  aiController.getOfficeKitStatus(req, res).catch(next);
});

router.post("/office-kit/connect", authenticateToken, (req, res, next) => {
  aiController.connectLaptop(req, res).catch(next);
});

router.post("/office-kit/heartbeat", authenticateToken, (req, res, next) => {
  aiController.laptopHeartbeat(req, res).catch(next);
});

router.post("/office-kit/disconnect", authenticateToken, (req, res, next) => {
  aiController.disconnectLaptop(req, res).catch(next);
});

router.post("/office-kit/transfer-task", authenticateToken, (req, res, next) => {
  aiController.transferTaskToLaptop(req, res).catch(next);
});

router.get("/office-kit/files", authenticateToken, (req, res, next) => {
  aiController.getOfficeKitFiles(req, res).catch(next);
});

router.get("/office-kit/download/:id", authenticateToken, (req, res, next) => {
  aiController.downloadOfficeKitFile(req, res).catch(next);
});

// AI Status (Real LLM vs Fallback)
router.get("/status", authenticateToken, (req, res, next) => {
  aiController.getStatus(req, res).catch(next);
});

// AI Plan Extraction
router.post("/plan", authenticateToken, (req, res, next) => {
  aiController.extractPlanFromText(req, res).catch(next);
});

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

// AI Decision Recommendation ("What should I do now?")
router.get("/recommendation", authenticateToken, (req, res, next) => {
  aiController.getRecommendation(req, res).catch(next);
});

// AI Personalized Insights
router.get("/insights", authenticateToken, (req, res, next) => {
  aiController.getInsights(req, res).catch(next);
});

// AI Chat Copilot
router.post("/chat", authenticateToken, (req, res, next) => {
  aiController.chat(req, res).catch(next);
});

// Execute Confirmed AI Actions
router.post("/execute-actions", authenticateToken, (req, res, next) => {
  aiController.executeActions(req, res).catch(next);
});

// AI Smart Task Breakdown
router.post("/breakdown", authenticateToken, (req, res, next) => {
  aiController.breakdownTask(req, res).catch(next);
});

// AI Task Duration Estimation
router.post("/estimate", authenticateToken, (req, res, next) => {
  aiController.estimateDuration(req, res).catch(next);
});

// AI Project Review & Bottleneck Analysis
router.post("/project-review/:projectId", authenticateToken, (req, res, next) => {
  aiController.getProjectReview(req, res).catch(next);
});

// AI Daily Executive Briefing
router.get("/daily-briefing", authenticateToken, (req, res, next) => {
  aiController.getDailyBriefing(req, res).catch(next);
});

// AI Weekly Performance & Pattern Review
router.get("/weekly-review", authenticateToken, (req, res, next) => {
  aiController.getWeeklyReview(req, res).catch(next);
});

export default router;


