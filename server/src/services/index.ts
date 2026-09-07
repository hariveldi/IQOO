import { TaskRepository, ProjectRepository, ActionInboxRepository, ReminderRepository, UserRepository } from "../repositories";
import { AIProvider } from "../ai/provider";
import { ExtractionService } from "../ai/extraction";
import { PlanningService, ScheduleBlock } from "../ai/planning";
import { CreateTaskInput, UpdateTaskInput, TaskStatus } from "@iqoo/shared";

export class TaskService {
  constructor(private taskRepo: TaskRepository) {}

  async createTask(userId: string, input: CreateTaskInput) {
    return this.taskRepo.create(userId, input);
  }

  async getTask(taskId: string, userId: string) {
    return this.taskRepo.findById(taskId, userId);
  }

  async getTasks(userId: string, options?: { projectId?: string; status?: TaskStatus }) {
    return this.taskRepo.findByUserId(userId, options);
  }

  async updateTask(taskId: string, userId: string, input: UpdateTaskInput) {
    return this.taskRepo.update(taskId, userId, input);
  }

  async deleteTask(taskId: string, userId: string) {
    return this.taskRepo.delete(taskId, userId);
  }

  async completeTask(taskId: string, userId: string, actualMinutes?: number) {
    return this.taskRepo.update(taskId, userId, {
      status: TaskStatus.COMPLETED,
      actualMinutes,
    });
  }

  async getTasksWithBlockers(userId: string) {
    return this.taskRepo.getTasksWithBlockers(userId);
  }
}

export class ProjectService {
  constructor(private projectRepo: ProjectRepository) {}

  async createProject(userId: string, input: { name: string; description?: string; color?: string }) {
    return this.projectRepo.create(userId, input);
  }

  async getProject(projectId: string, userId: string) {
    return this.projectRepo.findById(projectId, userId);
  }

  async getProjects(userId: string) {
    return this.projectRepo.findByUserId(userId);
  }

  async updateProject(projectId: string, userId: string, input: any) {
    return this.projectRepo.update(projectId, userId, input);
  }

  async deleteProject(projectId: string, userId: string) {
    return this.projectRepo.delete(projectId, userId);
  }

  async getProjectProgress(projectId: string, userId: string) {
    const project = await this.projectRepo.findById(projectId, userId);
    if (!project) return null;

    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter((t) => t.status === "COMPLETED").length;

    return {
      id: project.id,
      name: project.name,
      totalTasks,
      completedTasks,
      completionPercentage: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
    };
  }
}

export class ActionInboxService {
  constructor(private inboxRepo: ActionInboxRepository, private taskService: TaskService) {}

  async captureItem(userId: string, input: any) {
    return this.inboxRepo.create(userId, input);
  }

  async getInboxItems(userId: string) {
    return this.inboxRepo.findByUserId(userId);
  }

  async acceptItem(userId: string, itemId: string) {
    return this.inboxRepo.update(itemId, userId, { status: "ACCEPTED" });
  }

  async rejectItem(userId: string, itemId: string) {
    return this.inboxRepo.update(itemId, userId, { status: "REJECTED" });
  }

  async convertToTask(userId: string, itemId: string, taskData: CreateTaskInput) {
    const task = await this.taskService.createTask(userId, taskData);
    await this.inboxRepo.update(itemId, userId, {
      status: "CONVERTED",
      convertedTaskId: task.id,
      taskId: task.id,
    });
    return task;
  }
}

export class AIService {
  private extractionService: ExtractionService;
  private planningService: PlanningService;

  constructor(private aiProvider: AIProvider) {
    this.extractionService = new ExtractionService(aiProvider);
    this.planningService = new PlanningService();
  }

  async extractTaskFromVoice(audioTranscript: string) {
    return this.extractionService.extractTaskFromVoice(audioTranscript);
  }

  async extractFromImage(imageBase64: string, imageType?: string) {
    return this.extractionService.extractFromImage(imageBase64, imageType || "IMAGE");
  }

  async extractFromDocument(documentContent: string, fileName: string) {
    return this.extractionService.extractFromDocument(documentContent, fileName);
  }

  async extractFromMeeting(transcript: string, attendees?: string[]) {
    return this.extractionService.extractFromMeeting(transcript, attendees);
  }

  async getRecommendation(context: {
    completedTasks: number;
    pendingTasks: number;
    overdueTasks: number;
    highPriorityTasks: number;
  }) {
    return this.extractionService.generateRecommendation(context);
  }

  async generateDailySchedule(
    tasks: any[],
    options?: {
      workStartTime?: Date;
      workEndTime?: Date;
      breakInterval?: number;
      breakDuration?: number;
      availableHoursPerDay?: number;
    }
  ) {
    return this.planningService.generateDailySchedule(tasks, options);
  }

  async chat(message: string, context?: any) {
    return this.aiProvider.processConversation(message, context);
  }
}

export class AuthService {
  constructor(private userRepo: UserRepository) {}

  async getUserById(userId: string) {
    return this.userRepo.findById(userId);
  }

  async getUserByEmail(email: string) {
    return this.userRepo.findByEmail(email);
  }

  async createUser(data: { email: string; password: string; name: string }) {
    return this.userRepo.create(data);
  }
}
