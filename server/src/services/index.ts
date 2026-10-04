import {
  TaskRepository,
  ProjectRepository,
  ActionInboxRepository,
  UserRepository,
} from "../repositories";
import { AIProvider } from "../ai/provider";
import { PlanningService } from "../ai/planning";
import {
  CreateTaskInput,
  UpdateTaskInput,
  TaskStatus,
  TaskPriority,
  AIAction,
  AIChatMessage,
  AISmartRecommendation,
  AIActionPipelineResult,
} from "@iqoo/shared";
import { calculateTaskPriority, calculateDeadlineRisk } from "../productivity/prioritizer";
import { ContextBuilder } from "../ai/contextBuilder";
import { ActionExecutor } from "../ai/actions";

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

  async getTasksBlockedBy(taskId: string, userId: string) {
    return this.taskRepo.findTasksBlockedBy(taskId, userId);
  }

  async getTasksBlocking(taskId: string, userId: string) {
    return this.taskRepo.findTasksBlocking(taskId, userId);
  }

  async createDependency(fromTaskId: string, toTaskId: string, userId: string) {
    return this.taskRepo.createDependency(fromTaskId, toTaskId, userId);
  }

  async deleteDependency(fromTaskId: string, toTaskId: string, userId: string) {
    return this.taskRepo.deleteDependency(fromTaskId, toTaskId, userId);
  }

  async getDependencies(userId: string) {
    return this.taskRepo.findDependencies(userId);
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
  private planningService: PlanningService;

  constructor(
    private aiProvider: AIProvider,
    _taskProvider?: TaskService
  ) {
    this.planningService = new PlanningService();
  }

  getProviderStatus() {
    return {
      provider: this.aiProvider.getProviderName(),
      isRealAI: this.aiProvider.isRealAI(),
      model: this.aiProvider.isRealAI() ? (process.env.AI_MODEL || "gpt-4o-mini") : "deterministic-local",
      isConfigured: this.aiProvider.isRealAI() || !!process.env.OPENAI_API_KEY,
    };
  }

  async extractTaskFromVoice(userId: string, audioTranscript: string) {
    const context = await ContextBuilder.buildUserContext(userId);
    return this.aiProvider.extractTaskFromText(audioTranscript, context);
  }

  async processActionPipeline(
    userId: string,
    input: {
      text?: string;
      image?: string;
      mimeType?: string;
      imageType?: string;
      autoExecute?: boolean;
    }
  ): Promise<AIActionPipelineResult> {
    const context = await ContextBuilder.buildUserContext(userId);
    const understanding = await this.aiProvider.understandAndStructureAction(input, context);

    let executed = false;
    let executionResult: any = undefined;

    // If autoExecute is explicitly true or undefined (default true for instant productivity action), execute directly
    const shouldExecute = input.autoExecute !== false;

    if (shouldExecute && understanding.action) {
      const batchResult = await ActionExecutor.executeBatch(userId, [understanding.action]);
      const res = batchResult[0];
      if (res && res.success) {
        executed = true;
        executionResult = res.result;
      } else if (res && !res.success) {
        executionResult = { error: res.error };
      }
    }

    return {
      extractedInfo: understanding.extractedInfo,
      action: understanding.action,
      commitment: understanding.commitment || understanding.extractedInfo?.commitment,
      executed,
      executionResult,
      provider: this.aiProvider.getProviderName(),
      isFallback: !this.aiProvider.isRealAI(),
    };
  }

  async extractFromImage(_userId: string, imageBase64: string, imageType?: string) {
    return this.aiProvider.extractFromImage(imageBase64, imageType);
  }

  async extractFromDocument(_userId: string, documentContent: string, fileName: string) {
    return this.aiProvider.extractFromDocument(documentContent, fileName);
  }

  async extractPlanFromText(userId: string, text: string) {
    const context = await ContextBuilder.buildUserContext(userId);
    const plan = await this.aiProvider.extractPlanFromText(text, context);
    const allowedTaskIds = new Set(context.activeTasks.map((task) => task.id));
    const safeTasks = (plan.tasks || []).slice(0, 50).map((task: any) => ({
      ...task,
      estimatedMinutes: typeof task.estimatedMinutes === "number"
        ? Math.max(1, Math.min(1440, Math.round(task.estimatedMinutes)))
        : undefined,
      dependencies: Array.isArray(task.dependencies)
        ? task.dependencies.filter((id: string) => id.startsWith("temp_task_") || allowedTaskIds.has(id))
        : [],
      deadline: task.deadline && !isNaN(new Date(task.deadline).getTime()) ? task.deadline : undefined,
    }));

    return {
      ...plan,
      tasks: safeTasks,
      actions: (plan.actions || []).filter((action: any) => {
        if (action.type !== "CREATE_TASK") return action.type === "CREATE_PROJECT";
        const projectId = action.data?.projectId;
        return !projectId || projectId === "temp_proj_1" || context.projects.some((project) => project.id === projectId);
      }),
    };
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

  async chat(userId: string, message: string, history?: AIChatMessage[]) {
    const context = await ContextBuilder.buildUserContext(userId);
    return this.aiProvider.processConversation(message, context, history);
  }

  async executeActions(userId: string, actions: AIAction[]) {
    return ActionExecutor.executeBatch(userId, actions);
  }

  async getPersonalizedInsights(userId: string) {
    const context = await ContextBuilder.buildUserContext(userId);
    return this.aiProvider.generateInsights(context);
  }

  /**
   * High-intelligence decision engine for "What should I do now?"
   * Combines dependency graph analysis + deadline risk + LLM reasoning synthesis.
   */
  async getSmartRecommendation(userId: string): Promise<AISmartRecommendation | null> {
    const context = await ContextBuilder.buildUserContext(userId);
    if (!context.activeTasks || context.activeTasks.length === 0) {
      return {
        recommended: null,
        reason: "All tasks completed! You are completely clear.",
        whyThisTask: "No active tasks in database.",
        riskIfDelayed: "None.",
        expectedTime: "0 min",
        blockersExplanation: "No blockers.",
        provider: this.aiProvider.getProviderName(),
        isFallback: !this.aiProvider.isRealAI(),
      };
    }

    // Filter out blocked tasks
    const unblockedTasks = context.activeTasks.filter((t) => !t.isBlocked);
    if (unblockedTasks.length === 0) {
      const blockedTask = context.activeTasks[0];
      const blockers = (blockedTask.blockers || []).filter((b) => b.status !== "COMPLETED");
      return {
        recommended: null,
        reason: `All active tasks are currently waiting on prerequisite tasks.`,
        whyThisTask: `You have ${context.activeTasks.length} active tasks, but all are blocked.`,
        riskIfDelayed: `Workflow pipeline is stalled until blockers are cleared.`,
        expectedTime: `Prerequisite unblocking needed`,
        blockersExplanation: blockers.length > 0 ? `Blocked by: ${blockers.map((b) => b.title).join(", ")}` : "Blocked by dependent tasks.",
        provider: this.aiProvider.getProviderName(),
        isFallback: !this.aiProvider.isRealAI(),
      };
    }

    // Calculate algorithmic score for each unblocked task
    const scoredTasks = unblockedTasks.map((task) => {
      const priorityScore = calculateTaskPriority({
        deadline: task.deadline ? new Date(task.deadline) : undefined,
        priority: (task.priority as TaskPriority) || TaskPriority.MEDIUM,
        estimatedMinutes: task.estimatedMinutes ?? undefined,
        isOverdue: task.deadline ? new Date(task.deadline) < new Date() : false,
        hasDependencies: (task.unblocks && task.unblocks.length > 0) || false,
        isBlocked: false,
      });

      const risk = calculateDeadlineRisk({
        deadline: task.deadline ? new Date(task.deadline) : undefined,
        estimatedMinutes: task.estimatedMinutes ?? undefined,
        status: task.status,
        dependencies: (task.blockers || []).map((b) => b.id),
        unfinishedDependencies: 0,
        overdue: task.deadline ? new Date(task.deadline) < new Date() : false,
      });

      // Bonus for tasks that unblock downstream work
      const unblockBonus = (task.unblocks || []).length * 15;
      const combinedScore = priorityScore.score + risk.score + unblockBonus;

      return {
        task,
        priorityScore,
        risk,
        combinedScore,
      };
    });

    // Sort by combined score descending
    scoredTasks.sort((a, b) => b.combinedScore - a.combinedScore);
    const topScored = scoredTasks[0];
    const best = topScored.task;

    // Use AI Provider reasoning for deep explanation
    let aiReasoning: any = null;
    try {
      aiReasoning = await this.aiProvider.generateTaskRecommendation(context);
    } catch {
      aiReasoning = null;
    }

    const unblocksCount = (best.unblocks || []).filter((u) => u.status !== "COMPLETED").length;
    const defaultWhy = `"${best.title}" is your highest-leverage task. It has ${best.priority} priority, deadline risk score of ${topScored.risk.score}/100${unblocksCount > 0 ? `, and completing it will immediately unblock ${unblocksCount} downstream task(s)` : ""}.`;

    return {
      recommended: {
        id: best.id,
        title: best.title,
        description: best.description,
        projectId: best.projectId,
        projectName: best.projectName,
        priority: best.priority,
        deadline: best.deadline,
        estimatedMinutes: best.estimatedMinutes,
        blocks: (best.unblocks || []).map((t) => ({ id: t.id, title: t.title, status: t.status })),
        blockers: (best.blockers || []).map((t) => ({ id: t.id, title: t.title, status: t.status })),
        risk: topScored.risk,
      },
      reason: aiReasoning?.reason || `${best.priority} priority • ${topScored.risk.riskLevel} deadline risk`,
      whyThisTask: aiReasoning?.whyThisTask || defaultWhy,
      riskIfDelayed: aiReasoning?.riskIfDelayed || (best.deadline ? `Delaying risks missing deadline on ${new Date(best.deadline).toLocaleDateString()}.` : `Delaying stalls dependent workflows.`),
      expectedTime: aiReasoning?.expectedTime || `${best.estimatedMinutes || 45} minutes`,
      blockersExplanation: aiReasoning?.blockersExplanation || `Unblocked and ready for immediate execution.`,
      nextAfterThis: aiReasoning?.nextAfterThis || (scoredTasks[1] ? scoredTasks[1].task.title : undefined),
      provider: this.aiProvider.getProviderName(),
      isFallback: !this.aiProvider.isRealAI(),
    };
  }

  async breakdownTask(userId: string, taskTitle: string, description?: string) {
    const context = await ContextBuilder.buildUserContext(userId);
    return this.aiProvider.breakdownTask(taskTitle, description, context);
  }

  async estimateDuration(userId: string, taskTitle: string, description?: string) {
    const context = await ContextBuilder.buildUserContext(userId);
    return this.aiProvider.estimateDuration(taskTitle, description, context);
  }

  async generateProjectReview(userId: string, projectId: string, projectName: string, tasks: any[]) {
    const context = await ContextBuilder.buildUserContext(userId, { projectId });
    return this.aiProvider.generateProjectReview(projectId, projectName, tasks, context);
  }

  async generateDailyBriefing(userId: string) {
    const context = await ContextBuilder.buildUserContext(userId);
    return this.aiProvider.generateDailyBriefing(context);
  }

  async generateWeeklyReview(userId: string) {
    const context = await ContextBuilder.buildUserContext(userId);
    return this.aiProvider.generateWeeklyReview(context);
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




