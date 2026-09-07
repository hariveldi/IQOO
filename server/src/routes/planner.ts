import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { PlannerController } from "../controllers/plannerController";
import { AIService, TaskService } from "../services";
import { TaskRepository } from "../repositories";
import { AIProviderFactory } from "../ai/provider";
import { config } from "../config";

const router = Router();

const taskRepo = new TaskRepository();
const taskService = new TaskService(taskRepo);
const aiProvider = AIProviderFactory.create(config.ai.provider);
const aiService = new AIService(aiProvider);
const plannerController = new PlannerController(aiService, taskService);

// Daily planning routes
router.post("/daily", authenticateToken, (req, res, next) => {
  plannerController.generateDailyPlan(req, res).catch(next);
});

router.get("/daily", authenticateToken, (req, res, next) => {
  plannerController.getDailyPlan(req, res).catch(next);
});

router.post("/reschedule", authenticateToken, (req, res, next) => {
  plannerController.rescheduleAfterTaskCompletion(req, res).catch(next);
});

// Weekly planning routes
router.get("/weekly", authenticateToken, (req, res, next) => {
  plannerController.getWeeklyPlan(req, res).catch(next);
});

export default router;
