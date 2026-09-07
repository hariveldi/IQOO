import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { ProjectService } from "../services";
import { CreateProjectSchema, UpdateProjectSchema } from "@iqoo/shared";
import { AppError } from "../middleware/errorHandler";

export class ProjectController {
  constructor(private projectService: ProjectService) {}

  async createProject(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const input = CreateProjectSchema.parse(req.body);
    const project = await this.projectService.createProject(req.userId, input);

    res.status(201).json({
      success: true,
      data: { project },
    });
  }

  async getProject(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { id } = req.params;
    const project = await this.projectService.getProject(id, req.userId);

    if (!project) {
      throw new AppError(404, "Project not found", "PROJECT_NOT_FOUND");
    }

    res.json({
      success: true,
      data: { project },
    });
  }

  async listProjects(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const projects = await this.projectService.getProjects(req.userId);

    res.json({
      success: true,
      data: { projects },
    });
  }

  async updateProject(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { id } = req.params;
    const input = UpdateProjectSchema.parse(req.body);
    const project = await this.projectService.updateProject(id, req.userId, input);

    res.json({
      success: true,
      data: { project },
    });
  }

  async deleteProject(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { id } = req.params;
    await this.projectService.deleteProject(id, req.userId);

    res.json({
      success: true,
      message: "Project deleted",
    });
  }

  async getProjectProgress(req: AuthRequest, res: Response) {
    if (!req.userId) throw new AppError(401, "Not authenticated", "NOT_AUTHENTICATED");

    const { id } = req.params;
    const progress = await this.projectService.getProjectProgress(id, req.userId);

    if (!progress) {
      throw new AppError(404, "Project not found", "PROJECT_NOT_FOUND");
    }

    res.json({
      success: true,
      data: { progress },
    });
  }
}
