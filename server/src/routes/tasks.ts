import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { TaskController } from "../controllers/taskController";
import { TaskService } from "../services";
import { TaskRepository } from "../repositories";

const router = Router();

const taskRepo = new TaskRepository();
const taskService = new TaskService(taskRepo);
const taskController = new TaskController(taskService);

// Task routes
router.post("/", authenticateToken, (req, res, next) => {
  taskController.createTask(req, res).catch(next);
});

router.get("/", authenticateToken, (req, res, next) => {
  taskController.listTasks(req, res).catch(next);
});

router.get("/:id", authenticateToken, (req, res, next) => {
  taskController.getTask(req, res).catch(next);
});

router.patch("/:id", authenticateToken, (req, res, next) => {
  taskController.updateTask(req, res).catch(next);
});

router.delete("/:id", authenticateToken, (req, res, next) => {
  taskController.deleteTask(req, res).catch(next);
});

router.post("/:id/complete", authenticateToken, (req, res, next) => {
  taskController.completeTask(req, res).catch(next);
});

export default router;
