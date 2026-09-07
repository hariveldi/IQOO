import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { ProjectController } from "../controllers/projectController";
import { ProjectService } from "../services";
import { ProjectRepository } from "../repositories";

const router = Router();

const projectRepo = new ProjectRepository();
const projectService = new ProjectService(projectRepo);
const projectController = new ProjectController(projectService);

// Project routes
router.post("/", authenticateToken, (req, res, next) => {
  projectController.createProject(req, res).catch(next);
});

router.get("/", authenticateToken, (req, res, next) => {
  projectController.listProjects(req, res).catch(next);
});

router.get("/:id", authenticateToken, (req, res, next) => {
  projectController.getProject(req, res).catch(next);
});

router.patch("/:id", authenticateToken, (req, res, next) => {
  projectController.updateProject(req, res).catch(next);
});

router.delete("/:id", authenticateToken, (req, res, next) => {
  projectController.deleteProject(req, res).catch(next);
});

router.get("/:id/progress", authenticateToken, (req, res, next) => {
  projectController.getProjectProgress(req, res).catch(next);
});

export default router;
