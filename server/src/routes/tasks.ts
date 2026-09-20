import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { TaskController } from "../controllers/taskController";
import { TaskService } from "../services";
import { TaskRepository } from "../repositories";

const router = Router();

const taskRepo = new TaskRepository();
const taskService = new TaskService(taskRepo);
const taskController = new TaskController(taskService);

// Dependencies routes (must be before /:id routes)
router.get("/dependencies", authenticateToken, (req, res, next) => {
  taskController.listDependencies(req as any, res).catch(next);
});

router.post("/dependencies", authenticateToken, (req, res, next) => {
  taskController.createDependency(req as any, res).catch(next);
});

router.delete("/dependencies", authenticateToken, (req, res, next) => {
  taskController.deleteDependency(req as any, res).catch(next);
});

// Task CRUD routes
router.post("/", authenticateToken, (req, res, next) => {
  taskController.createTask(req as any, res).catch(next);
});

router.get("/", authenticateToken, (req, res, next) => {
  taskController.listTasks(req as any, res).catch(next);
});

router.get("/:id", authenticateToken, (req, res, next) => {
  taskController.getTask(req as any, res).catch(next);
});

router.patch("/:id", authenticateToken, (req, res, next) => {
  taskController.updateTask(req as any, res).catch(next);
});

router.delete("/:id", authenticateToken, (req, res, next) => {
  taskController.deleteTask(req as any, res).catch(next);
});

router.post("/:id/complete", authenticateToken, (req, res, next) => {
  taskController.completeTask(req as any, res).catch(next);
});

router.get("/:id/risk", authenticateToken, (req, res, next) => {
  taskController.getTaskRisk(req as any, res).catch(next);
});

router.get("/:id/blockers", authenticateToken, (req, res, next) => {
  taskController.getDependencyInfo(req as any, res).catch(next);
});

export default router;


