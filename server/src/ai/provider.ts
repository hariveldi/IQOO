import axios from "axios";
import {
  TaskExtractionResult,
  DocumentExtractionResult,
  AIPlan,
  AIChatResponse,
  AIUserContext,
  AIChatMessage,
  AIAction,
  AIProductivityInsight,
  AIDailyBriefing,
  AITaskBreakdown,
  AIProjectReview,
  AIWeeklyReview,
  TaskPriority,
} from "@iqoo/shared";
import { logger } from "../config/logger";
import { ContextBuilder } from "./contextBuilder";

/**
 * Abstract AI Provider interface
 * Enables swapping OpenAI, Anthropic, Ollama, and deterministic local fallback
 */
export interface AIProvider {
  getProviderName(): "openai" | "xkiro" | "local_fallback" | "anthropic" | "ollama";
  isRealAI(): boolean;

  processConversation(
    message: string,
    context: AIUserContext,
    history?: AIChatMessage[]
  ): Promise<AIChatResponse>;

  extractPlanFromText(
    text: string,
    context?: AIUserContext
  ): Promise<AIPlan & { actions?: AIAction[] }>;

  extractTaskFromText(
    text: string,
    context?: AIUserContext
  ): Promise<TaskExtractionResult>;

  extractFromImage(
    imageBase64: string,
    imageType?: string
  ): Promise<TaskExtractionResult>;

  extractFromDocument(
    documentContent: string,
    fileName: string
  ): Promise<DocumentExtractionResult>;

  generateTaskRecommendation(context: AIUserContext): Promise<{
    reason: string;
    whyThisTask: string;
    riskIfDelayed: string;
    expectedTime: string;
    blockersExplanation: string;
    nextAfterThis?: string;
  }>;

  generateInsights(context: AIUserContext): Promise<AIProductivityInsight[]>;

  breakdownTask(
    taskTitle: string,
    description?: string,
    context?: AIUserContext
  ): Promise<AITaskBreakdown>;

  estimateDuration(
    taskTitle: string,
    description?: string,
    context?: AIUserContext
  ): Promise<{ estimatedMinutes: number; confidence: number; rationale: string }>;

  generateProjectReview(
    projectId: string,
    projectName: string,
    tasks?: any[],
    context?: AIUserContext
  ): Promise<AIProjectReview>;

  generateDailyBriefing(context?: AIUserContext): Promise<AIDailyBriefing>;

  generateWeeklyReview(context?: AIUserContext): Promise<AIWeeklyReview>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public code: "AI_PROVIDER_RATE_LIMIT" | "AI_PROVIDER_UNAVAILABLE" | "AI_PROVIDER_TIMEOUT" | "AI_PROVIDER_MALFORMED_OUTPUT",
    public statusCode: number
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

/**
 * Helper to clean JSON string from Markdown wrappers
 */
function cleanJsonOutput(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  return cleaned.trim();
}

/**
 * Real OpenAI Provider using standard Chat Completions API
 */
export class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private apiBase: string;
  private providerName: "openai" | "xkiro";

  constructor(
    apiKey: string,
    model: string = "gpt-4o-mini",
    apiBase?: string,
    providerName: "openai" | "xkiro" = "openai"
  ) {
    this.apiKey = apiKey;
    this.model = model || "gpt-4o-mini";
    this.apiBase = apiBase || "https://api.openai.com/v1";
    this.providerName = providerName;
  }

  getProviderName(): "openai" | "xkiro" {
    return this.providerName;
  }

  isRealAI(): boolean {
    return true;
  }

  private async callOpenAI(messages: any[], temperature: number = 0.3, responseFormatJson: boolean = false): Promise<string> {
    try {
      const payload: any = {
        model: this.model,
        messages,
        temperature,
        max_tokens: 2000,
      };

      if (responseFormatJson) {
        payload.response_format = { type: "json_object" };
      }

      const res = await axios.post(`${this.apiBase}/chat/completions`, payload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 35000,
      });

      const content = res.data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response returned from OpenAI API");
      }
      return content;
    } catch (err: any) {
      const status = err?.response?.status;
      const errMsg = err?.response?.data?.error?.message || err?.message || "OpenAI request failed";
      logger.error(`${this.providerName} API error (${this.model}): ${errMsg}`);
      if (status === 429) {
        throw new AIProviderError("The AI provider is rate-limited. Please wait a moment and try again.", "AI_PROVIDER_RATE_LIMIT", 429);
      }
      if (err?.code === "ECONNABORTED" || /timeout/i.test(errMsg)) {
        throw new AIProviderError("The AI provider timed out. Please try again.", "AI_PROVIDER_TIMEOUT", 504);
      }
      throw new AIProviderError(`The AI provider is unavailable: ${errMsg}`, "AI_PROVIDER_UNAVAILABLE", 503);
    }
  }

  async processConversation(
    message: string,
    context: AIUserContext,
    history: AIChatMessage[] = []
  ): Promise<AIChatResponse> {
    const formattedContext = ContextBuilder.formatContextForPrompt(context);

    const systemPrompt = `You are the iQOO AI Productivity Copilot — an intelligent, context-aware executive assistant.
You have real-time access to the user's actual database (tasks, projects, dependencies, deadlines, blockers, focus records).

${formattedContext}

CRITICAL INSTRUCTIONS:
1. ALWAYS reason over the user's REAL database tasks provided above. When referencing tasks, use their actual titles, IDs, priorities, and deadlines.
2. If the user asks what to work on (e.g., "I have 3 hours tonight", "What should I finish?"), inspect their active tasks, estimate realistic time fit, check blockers, and recommend a prioritized sequence with rationale.
3. If the user asks to create, update, delete, schedule, or link tasks/projects/dependencies, explain your plan in the message AND generate structured actions in the "actions" array.
4. If the user mentions a goal (e.g., "build website by Friday"), break it down into realistic tasks with estimatedMinutes, priorities, deadlines, and dependencies.
5. If the user asks about blockers or risks, trace their dependency graph and upcoming deadlines.
6. Return a valid JSON object matching this exact schema:
{
  "message": "Clear, friendly, conversational Markdown response explaining your reasoning and recommendations.",
  "reasoning": "Brief explanation of why you recommended this specific plan or action.",
  "suggestedFollowUps": ["Question 1 user might ask next", "Question 2"],
  "actions": [
    {
      "type": "CREATE_TASK" | "UPDATE_TASK" | "DELETE_TASK" | "CREATE_DEPENDENCY" | "CREATE_PROJECT" | "SCHEDULE_PLAN",
      "description": "Human readable summary of this action",
      "data": { ...action payload... }
    }
  ]
}

Action Data Specifications:
- CREATE_TASK: { "title": string, "description"?: string, "priority": "CRITICAL"|"HIGH"|"MEDIUM"|"LOW", "estimatedMinutes"?: number, "deadline"?: string(ISO), "projectId"?: string, "tags"?: string[], "dependencies"?: string[](prerequisite task IDs or tempIds) }
- UPDATE_TASK: { "taskId": string, "title"?: string, "status"?: "TODO"|"IN_PROGRESS"|"COMPLETED", "priority"?: string, "deadline"?: string, "estimatedMinutes"?: number }
- CREATE_DEPENDENCY: { "fromTaskId": string (prerequisite), "toTaskId": string (blocked task) }
- CREATE_PROJECT: { "name": string, "description"?: string, "color"?: string }
- SCHEDULE_PLAN: { "date": string(ISO), "blocks": [{ "taskId": string, "taskTitle": string, "startTime": string(ISO), "endTime": string(ISO), "reason": string }] }
`;

    const openAiMessages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];

    try {
      const rawResponse = await this.callOpenAI(openAiMessages, 0.3, true);
      const cleanedResponse = cleanJsonOutput(rawResponse);
      let parsed: any;

      try {
        parsed = JSON.parse(cleanedResponse);
      } catch {
        return {
          message: rawResponse,
          actions: [],
          provider: this.getProviderName(),
          isFallback: false,
        };
      }

      return {
        message: parsed.message || rawResponse,
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        reasoning: parsed.reasoning,
        suggestedFollowUps: parsed.suggestedFollowUps || [],
        provider: this.getProviderName(),
        isFallback: false,
      };
    } catch (err: any) {
      logger.error("Failed to parse OpenAI conversation response:", err);
      if (err instanceof AIProviderError) throw err;
      // Fallback response with error notice
      return {
        message: `I encountered an issue processing your request through the AI model: ${err.message}. Please try again.`,
        provider: this.getProviderName(),
        isFallback: false,
      };
    }
  }

  async extractPlanFromText(
    text: string,
    context?: AIUserContext
  ): Promise<AIPlan & { actions?: AIAction[] }> {
    const contextPrompt = context ? ContextBuilder.formatContextForPrompt(context) : "";

    const systemPrompt = `You are an expert AI productivity planner.
Extract a complete project plan from the user's input.
${contextPrompt}

Output MUST be a valid JSON object matching:
{
  "project": "Project Name",
  "deadline": "2026-09-20T23:59:59Z" (or null if none mentioned),
  "notes": "Plan summary and strategy",
  "tasks": [
    {
      "title": "Task title",
      "description": "Optional details",
      "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "estimatedMinutes": 60,
      "deadline": "2026-09-20T23:59:59Z",
      "tags": ["tag1"],
      "dependencies": []
    }
  ]
}`;

    const raw = await this.callOpenAI(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      0.2,
      true
    );

    const parsed = JSON.parse(cleanJsonOutput(raw));
    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];

    // Convert plan into actions for easy review
    const actions: AIAction[] = [
      {
        type: "CREATE_PROJECT",
        description: `Create project "${parsed.project || "New Project"}"`,
        data: {
          name: parsed.project || "New Project",
          description: parsed.notes,
          tempId: "temp_proj_1",
        },
      },
      ...tasks.map((t: any, idx: number) => ({
        type: "CREATE_TASK" as const,
        description: `Create task: ${t.title} (${t.priority || "MEDIUM"}, ${t.estimatedMinutes || 60}m)`,
        data: {
          ...t,
          projectId: "temp_proj_1",
          tempId: `temp_task_${idx + 1}`,
        },
      })),
    ];

    return {
      project: parsed.project || "New Project",
      deadline: parsed.deadline ? new Date(parsed.deadline) : undefined,
      notes: parsed.notes,
      tasks: tasks.map((t: any) => ({
        ...t,
        deadline: t.deadline ? new Date(t.deadline) : undefined,
      })),
      actions,
    };
  }

  async extractTaskFromText(
    text: string,
    context?: AIUserContext
  ): Promise<TaskExtractionResult> {
    const contextPrompt = context ? ContextBuilder.formatContextForPrompt(context) : "";

    const systemPrompt = `You are an AI task extraction specialist.
Extract a structured task from the user's voice transcript or natural text.
Infer missing details intelligently based on context.
${contextPrompt}

Return JSON:
{
  "title": "Action-oriented task title",
  "description": "Any additional context or details",
  "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "estimatedMinutes": 45,
  "deadline": "2026-09-20T18:00:00Z" (or null),
  "project": "Project name if mentioned or null",
  "people": ["Alice", "Bob"],
  "confidence": 0.95
}`;

    const raw = await this.callOpenAI(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      0.2,
      true
    );

    const parsed = JSON.parse(cleanJsonOutput(raw));
    return {
      title: parsed.title || text.slice(0, 50),
      description: parsed.description || text,
      priority: parsed.priority || "MEDIUM",
      estimatedMinutes: parsed.estimatedMinutes || 30,
      deadline: parsed.deadline ? new Date(parsed.deadline) : undefined,
      project: parsed.project || undefined,
      people: parsed.people || [],
      confidence: parsed.confidence || 0.9,
    };
  }

  async extractFromImage(
    imageBase64: string,
    imageType?: string
  ): Promise<TaskExtractionResult> {
    const systemPrompt = `You are an AI vision extraction assistant.
Extract structured actionable productivity tasks and key information from this ${imageType || "image"}.
Return JSON:
{
  "title": "Extracted Action Item",
  "description": "Detailed description of content",
  "priority": "HIGH",
  "estimatedMinutes": 45,
  "confidence": 0.85
}`;

    try {
      const messages = [
        {
          role: "user",
          content: [
            { type: "text", text: systemPrompt },
            {
              type: "image_url",
              image_url: {
                url: imageBase64.startsWith("data:")
                  ? imageBase64
                  : `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ];

      const raw = await this.callOpenAI(messages, 0.2, true);
      const parsed = JSON.parse(cleanJsonOutput(raw));
      return {
        title: parsed.title || "Task from Image",
        description: parsed.description || "Image content processed",
        priority: parsed.priority || "HIGH",
        estimatedMinutes: parsed.estimatedMinutes || 45,
        confidence: parsed.confidence || 0.85,
      };
    } catch (err: any) {
      if (err instanceof AIProviderError) throw err;
      return {
        title: `Task from ${imageType || "Image"}`,
        description: "Visual item captured",
        priority: TaskPriority.MEDIUM,
        estimatedMinutes: 30,
        confidence: 0.7,
      };
    }
  }

  async extractFromDocument(
    documentContent: string,
    fileName: string
  ): Promise<DocumentExtractionResult> {
    const systemPrompt = `You are an AI document intelligence analyst.
Analyze the document "${fileName}" and extract actionable tasks, key decisions, summary, and deadlines.
Return JSON:
{
  "summary": "Concise executive summary of document",
  "keyPoints": ["Key point 1", "Key point 2"],
  "actionItems": ["Action 1", "Action 2"],
  "decisions": ["Decision 1"],
  "people": ["Name 1"],
  "tasks": [
    {
      "title": "Specific Task",
      "priority": "HIGH",
      "estimatedMinutes": 60,
      "deadline": "2026-09-20T23:59:59Z"
    }
  ]
}`;

    const raw = await this.callOpenAI(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `File Name: ${fileName}\n\nContent:\n${documentContent.slice(0, 8000)}` },
      ],
      0.2,
      true
    );

    const parsed = JSON.parse(cleanJsonOutput(raw));
    return {
      summary: parsed.summary || "Document parsed successfully.",
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      people: Array.isArray(parsed.people) ? parsed.people : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    };
  }

  async generateTaskRecommendation(context: AIUserContext): Promise<{
    reason: string;
    whyThisTask: string;
    riskIfDelayed: string;
    expectedTime: string;
    blockersExplanation: string;
    nextAfterThis?: string;
  }> {
    const formattedContext = ContextBuilder.formatContextForPrompt(context);
    const systemPrompt = `You are the iQOO Decision Intelligence Engine.
Analyze the user's active tasks, blockers, dependencies, and upcoming deadlines to determine the single most impactful task they should execute right now.

${formattedContext}

Return JSON with rich, data-grounded reasoning:
{
  "taskId": "id of the best task to work on",
  "reason": "Clear 1-sentence reason",
  "whyThisTask": "Detailed 2-3 sentence explanation based on deadline urgency, project priority, and unblocking downstream work.",
  "riskIfDelayed": "Specific consequences if this task is delayed (e.g. what deadlines are breached, which 2 downstream tasks remain blocked).",
  "expectedTime": "e.g. 45 min estimated focus session",
  "blockersExplanation": "e.g. Nothing blocking this task. Ready to execute immediately.",
  "nextAfterThis": "The exact task to tackle next once this is completed."
}`;

    const raw = await this.callOpenAI(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: "What should I do now?" },
      ],
      0.2,
      true
    );

    const parsed = JSON.parse(cleanJsonOutput(raw));
    return {
      reason: parsed.reason || "High impact task with upcoming deadline.",
      whyThisTask: parsed.whyThisTask || "This task delivers the highest immediate leverage.",
      riskIfDelayed: parsed.riskIfDelayed || "Delaying risks missing deadline and blocking dependent work.",
      expectedTime: parsed.expectedTime || "45 min",
      blockersExplanation: parsed.blockersExplanation || "Unblocked and ready.",
      nextAfterThis: parsed.nextAfterThis || undefined,
    };
  }

  async generateInsights(context: AIUserContext): Promise<AIProductivityInsight[]> {
    const formattedContext = ContextBuilder.formatContextForPrompt(context);
    const systemPrompt = `You are a productivity data scientist.
Analyze the user's actual productivity history and task metrics.
${formattedContext}

Generate 2-4 personalized, data-backed insights. DO NOT invent fake claims if data is insufficient.
Return JSON:
{
  "insights": [
    {
      "title": "Insight Title",
      "insight": "Data-grounded observation",
      "type": "WARNING" | "SUCCESS" | "RECOMMENDATION" | "NEUTRAL",
      "metricSource": "e.g. 3 overdue tasks vs 5 completed",
      "actionableSuggestion": "Specific action user should take"
    }
  ]
}`;

    const raw = await this.callOpenAI(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate personalized productivity insights." },
      ],
      0.3,
      true
    );

    const parsed = JSON.parse(cleanJsonOutput(raw));
    return Array.isArray(parsed.insights) ? parsed.insights : [];
  }

  async breakdownTask(
    taskTitle: string,
    description?: string,
    context?: AIUserContext
  ): Promise<AITaskBreakdown> {
    const formattedContext = context ? ContextBuilder.formatContextForPrompt(context) : "";
    const systemPrompt = `You are a productivity architect.
Decompose the given task into 3-5 clear, highly actionable, sequential subtasks.
${formattedContext}

Return JSON strictly in this structure:
{
  "subtasks": [
    {
      "title": "Subtask title",
      "description": "Short explanation",
      "estimatedMinutes": 30,
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "dependsOnPrevious": true
    }
  ]
}`;

    const raw = await this.callOpenAI(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Break down task: "${taskTitle}"\nDescription: ${description || "None"}` },
      ],
      0.2,
      true
    );

    const parsed = JSON.parse(cleanJsonOutput(raw));
    const subtasks = Array.isArray(parsed.subtasks) ? parsed.subtasks : [];
    
    // Generate CREATE_TASK actions for each subtask
    const actions: AIAction[] = subtasks.map((st: any) => ({
      type: "CREATE_TASK",
      description: `Create subtask: ${st.title}`,
      data: {
        title: st.title,
        description: st.description || "",
        estimatedMinutes: st.estimatedMinutes || 30,
        priority: st.priority || TaskPriority.MEDIUM,
      },
    }));

    return {
      originalTask: taskTitle,
      subtasks,
      actions,
      provider: this.getProviderName(),
      isFallback: false,
    };
  }

  async estimateDuration(
    taskTitle: string,
    description?: string,
    context?: AIUserContext
  ): Promise<{ estimatedMinutes: number; confidence: number; rationale: string }> {
    const formattedContext = context ? ContextBuilder.formatContextForPrompt(context) : "";
    const systemPrompt = `You are an expert effort estimation engine.
Estimate realistic minutes needed to finish this task considering task complexity and user focus history.
${formattedContext}

Return JSON:
{
  "estimatedMinutes": 45,
  "confidence": 0.85,
  "rationale": "Reasoning based on task scope and past completion metrics."
}`;

    const raw = await this.callOpenAI(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Estimate duration for: "${taskTitle}"\nDescription: ${description || "None"}` },
      ],
      0.2,
      true
    );

    const parsed = JSON.parse(cleanJsonOutput(raw));
    return {
      estimatedMinutes: parsed.estimatedMinutes || 30,
      confidence: parsed.confidence || 0.8,
      rationale: parsed.rationale || "Estimated based on task scope.",
    };
  }

  async generateProjectReview(
    projectId: string,
    projectName: string,
    tasks: any[] = [],
    context?: AIUserContext
  ): Promise<AIProjectReview> {
    const formattedContext = context ? ContextBuilder.formatContextForPrompt(context) : "";
    const completedCount = tasks.filter((t) => t.status === "COMPLETED").length;
    const totalCount = tasks.length;
    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const remainingMins = tasks
      .filter((t) => t.status !== "COMPLETED")
      .reduce((acc, t) => acc + (t.estimatedMinutes || 30), 0);

    const systemPrompt = `You are an AI Project Risk & Strategy Director.
Review project "${projectName}" containing ${totalCount} tasks (${completedCount} completed, ${totalCount - completedCount} remaining).
Tasks in project:
${JSON.stringify(tasks, null, 2)}

User Context:
${formattedContext}

Analyze blockers, dependency chain risks, and deadline feasibility.
Return JSON:
{
  "healthStatus": "HEALTHY" | "AT_RISK" | "BLOCKED" | "ON_TRACK",
  "healthPercentage": ${pct},
  "executiveSummary": "2-3 sentence assessment of the project state and critical path.",
  "bottlenecks": ["Specific blocker or risk item 1", "Bottleneck 2"],
  "recommendations": ["Actionable step 1", "Actionable step 2", "Actionable step 3"],
  "criticalPath": ["Task name 1", "Task name 2"]
}`;

    const raw = await this.callOpenAI(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate project review for project "${projectName}"` },
      ],
      0.2,
      true
    );

    const parsed = JSON.parse(cleanJsonOutput(raw));
    return {
      projectId,
      projectName,
      healthStatus: parsed.healthStatus || (pct > 60 ? "HEALTHY" : "AT_RISK"),
      healthPercentage: typeof parsed.healthPercentage === "number" ? parsed.healthPercentage : pct,
      executiveSummary: parsed.executiveSummary || `Project is ${pct}% complete with ${totalCount - completedCount} remaining tasks.`,
      bottlenecks: Array.isArray(parsed.bottlenecks) ? parsed.bottlenecks : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      criticalPath: Array.isArray(parsed.criticalPath) ? parsed.criticalPath : [],
      estimatedRemainingMinutes: remainingMins,
      provider: this.getProviderName(),
      isFallback: false,
    };
  }

  async generateDailyBriefing(context: AIUserContext): Promise<AIDailyBriefing> {
    const formattedContext = ContextBuilder.formatContextForPrompt(context);
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    const dueToday = context.activeTasks.filter((t) => {
      if (!t.deadline) return false;
      const d = typeof t.deadline === "string" ? t.deadline : new Date(t.deadline).toISOString();
      return d.startsWith(todayStr);
    });

    const overdue = context.activeTasks.filter((t) => {
      if (!t.deadline) return false;
      return new Date(t.deadline).getTime() < now.getTime();
    });

    const blocked = context.activeTasks.filter((t) => t.isBlocked);
    const totalEstMins = context.activeTasks.reduce((acc, t) => acc + (t.estimatedMinutes || 30), 0);
    const estWorkHours = parseFloat((totalEstMins / 60).toFixed(1));

    const systemPrompt = `You are the iQOO AI Executive Chief of Staff.
Generate an intelligent, highly personalized morning briefing grounded strictly in the user's real database context.
${formattedContext}

Return JSON:
{
  "greeting": "Good morning / afternoon",
  "summary": "Crisp 2-3 sentence overview of today's workload, urgency, and focus strategy.",
  "topAction": {
    "title": "Highest impact task title",
    "why": "Specific reason this unlocks work or prevents risk",
    "unlocks": "Downstream task or milestone unlocked"
  },
  "suggestedSchedule": [
    {
      "timeSlot": "09:00 - 10:30",
      "taskTitle": "Task Name",
      "durationMinutes": 90
    }
  ],
  "deadlineAlerts": [
    {
      "title": "Task title",
      "deadline": "Formatted deadline",
      "urgency": "HIGH" | "CRITICAL" | "MEDIUM"
    }
  ]
}`;

    const raw = await this.callOpenAI(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate my daily productivity briefing." },
      ],
      0.2,
      true
    );

    const parsed = JSON.parse(cleanJsonOutput(raw));
    return {
      greeting: parsed.greeting || "Good day.",
      summary: parsed.summary || `You have ${context.activeTasks.length} active tasks today (${overdue.length} overdue, ${blocked.length} blocked).`,
      totalTasksToday: context.activeTasks.length,
      dueTodayCount: dueToday.length,
      overdueCount: overdue.length,
      blockedCount: blocked.length,
      estimatedWorkHours: estWorkHours,
      availableHours: context.availableHoursTonight || 4,
      topAction: parsed.topAction || null,
      suggestedSchedule: Array.isArray(parsed.suggestedSchedule) ? parsed.suggestedSchedule : [],
      deadlineAlerts: Array.isArray(parsed.deadlineAlerts) ? parsed.deadlineAlerts : [],
      provider: this.getProviderName(),
      isFallback: false,
    };
  }

  async generateWeeklyReview(context: AIUserContext): Promise<AIWeeklyReview> {
    const formattedContext = ContextBuilder.formatContextForPrompt(context);
    const systemPrompt = `You are a high-performance productivity coach.
Analyze the user's completed tasks, overdue load, and focus metrics to produce a weekly review.
${formattedContext}

Return JSON:
{
  "summary": "Executive summary of weekly performance and trends.",
  "completionVelocity": "e.g. 14 tasks completed (+20% vs baseline)",
  "topBottleneckProject": "Project name that had most blockers/delays",
  "actionableChanges": ["Change 1", "Change 2", "Change 3"],
  "productivityScore": 85
}`;

    const raw = await this.callOpenAI(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate my weekly productivity review." },
      ],
      0.3,
      true
    );

    const parsed = JSON.parse(cleanJsonOutput(raw));
    return {
      summary: parsed.summary || `You completed ${context.completedTasksCount} tasks with ${context.overdueTasksCount} overdue.`,
      completionVelocity: parsed.completionVelocity || `${context.completedTasksCount} tasks completed`,
      topBottleneckProject: parsed.topBottleneckProject || undefined,
      actionableChanges: Array.isArray(parsed.actionableChanges) ? parsed.actionableChanges : [],
      productivityScore: typeof parsed.productivityScore === "number" ? parsed.productivityScore : 78,
      provider: this.getProviderName(),
      isFallback: false,
    };
  }
}

/**
 * xKiro provider using its OpenAI-compatible Chat Completions API.
 */
export class XKiroProvider extends OpenAIProvider {
  constructor(apiKey: string) {
    super(apiKey, "minimax/minimax-m3:free", "https://api.xkiro.com/v1", "xkiro");
  }
}

/**
 * Local Deterministic AI Provider (Explicit Fallback / Development Mode)
 * Transparently labels responses as deterministic fallback.
 */
export class LocalAIProvider implements AIProvider {
  getProviderName(): "local_fallback" {
    return "local_fallback";
  }

  isRealAI(): boolean {
    return false;
  }

  async processConversation(
    message: string,
    context: AIUserContext,
    _history: AIChatMessage[] = []
  ): Promise<AIChatResponse> {
    const lower = message.toLowerCase();
    const actions: AIAction[] = [];
    let responseText = "";
    let reasoning = "";
    const followUps: string[] = [];

    // Check for "3 hours tonight" or available time query
    const timeMatch = lower.match(/(\d+)\s*(?:hours?|hrs?)/);
    if (lower.includes("tonight") || lower.includes("today") || timeMatch) {
      const availableHours = timeMatch ? parseInt(timeMatch[1], 10) : 3;
      const availableMinutes = availableHours * 60;

      const unblockedTasks = context.activeTasks.filter((t) => !t.isBlocked);
      let used = 0;
      const selectedTasks: any[] = [];

      for (const t of unblockedTasks) {
        const est = t.estimatedMinutes || 45;
        if (used + est <= availableMinutes) {
          selectedTasks.push(t);
          used += est;
        }
      }

      if (selectedTasks.length > 0) {
        responseText = `Based on your **${availableHours} hours** of available time tonight, here is your realistic execution order:\n\n` +
          selectedTasks
            .map((t, idx) => `${idx + 1}. **${t.title}** (${t.estimatedMinutes || 45}m, ${t.priority} priority)`)
            .join("\n") +
          `\n\n**Total Estimated Time:** ${used} minutes (${(used / 60).toFixed(1)} hrs).\n` +
          `*(Note: Running in Deterministic Local Mode. Set OPENAI_API_KEY for full neural reasoning.)*`;
        reasoning = `Selected unblocked tasks fitting within ${availableHours}h limit, prioritized by priority and deadline.`;
      } else {
        responseText = `You currently have no unblocked tasks that fit within ${availableHours} hours, or all your tasks are completed.`;
        reasoning = `No actionable tasks matched the time budget.`;
      }

      followUps.push("What is blocking my other tasks?", "Create a detailed schedule for tonight");
    } else if (lower.includes("block") || lower.includes("depend")) {
      const blockedTasks = context.activeTasks.filter((t) => t.isBlocked);
      if (blockedTasks.length > 0) {
        responseText = `### ⚠️ Blocked Tasks Analysis\n\n` +
          blockedTasks
            .map((t) => {
              const blockerNames = (t.blockers || []).map((b) => `\`${b.title}\``).join(", ");
              return `- **${t.title}** is currently blocked by: ${blockerNames || "an unfinished prerequisite"}`;
            })
            .join("\n") +
          `\n\n**Recommendation:** Complete the prerequisite tasks first to unblock your pipeline.`;
        reasoning = `Inspected task dependency graph in database.`;
      } else {
        responseText = `Good news! None of your ${context.activeTasks.length} active tasks are currently blocked by dependencies.`;
        reasoning = `Dependency graph has no unfinished blockers.`;
      }
      followUps.push("What should I do now?", "Show tasks at risk this week");
    } else if (lower.includes("risk") || lower.includes("deadline")) {
      const now = new Date();
      const atRisk = context.activeTasks.filter((t) => {
        if (!t.deadline) return false;
        const diffDays = (new Date(t.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
      });

      if (atRisk.length > 0) {
        responseText = `### 🚨 Tasks At Risk This Week\n\n` +
          atRisk
            .map((t) => {
              const due = t.deadline ? new Date(t.deadline).toLocaleDateString() : "Soon";
              const isOver = t.deadline && new Date(t.deadline) < now;
              return `- **${t.title}** — ${isOver ? "⚠️ OVERDUE" : `Due ${due}`} (${t.priority} priority, ${t.estimatedMinutes || 30}m est)`;
            })
            .join("\n");
        reasoning = `Filtered active tasks with deadlines within the next 7 days.`;
      } else {
        responseText = `No immediate deadline risks detected within the next 7 days.`;
        reasoning = `No active tasks have imminent deadlines.`;
      }
      followUps.push("I have 3 hours tonight. What should I finish?", "Break down my project");
    } else if (lower.includes("create") || lower.includes("build") || lower.includes("plan") || lower.includes("project")) {
      // Natural language task/plan creation intent
      const taskMatch = message.match(/(?:task|project|build|create|do|finish)[\s:]*(.+?)(?:\.|$)/i);
      const title = taskMatch ? taskMatch[1].trim() : "New Project Task";

      actions.push({
        type: "CREATE_TASK",
        description: `Create task: ${title}`,
        data: {
          title,
          priority: TaskPriority.HIGH,
          estimatedMinutes: 60,
          status: "TODO",
        },
      });

      responseText = `I have structured a proposed action to create **"${title}"**.\n\nPlease review and confirm the proposed action card below to apply it to your database.`;
      reasoning = `Identified task creation intent from input.`;
      followUps.push("Show my active tasks", "What should I do now?");
    } else {
      responseText = `I'm your iQOO Productivity Copilot. I'm currently running in **Local Fallback Mode** with access to your ${context.activeTasks.length} active tasks and ${context.projects.length} projects.\n\nYou can ask me:\n- *"I have 3 hours tonight. What should I finish?"*\n- *"What is blocking my highest priority task?"*\n- *"What tasks are at risk this week?"*\n- *"Create a task to finish the presentation by Friday"*`;
      reasoning = `Local fallback default response.`;
      followUps.push("I have 3 hours tonight. What should I finish?", "What is blocking my highest priority task?");
    }

    return {
      message: responseText,
      actions,
      reasoning,
      suggestedFollowUps: followUps,
      provider: "local_fallback",
      isFallback: true,
    };
  }

  async extractPlanFromText(
    text: string,
    _context?: AIUserContext
  ): Promise<AIPlan & { actions?: AIAction[] }> {
    const taskPattern = /(finish|prepare|test|practice|buy|call|complete|implement|setup|design|write|document|review|submit|analyze|meet|plan|build) ([^.,]+)(?=[.,]|$)/gi;
    const tasks: any[] = [];
    let match;

    while ((match = taskPattern.exec(text)) !== null) {
      tasks.push({
        title: match[1][0].toUpperCase() + match[1].slice(1) + " " + match[2].trim(),
        priority: TaskPriority.HIGH,
        estimatedMinutes: 60,
      });
    }

    if (tasks.length === 0) {
      text.split(/,| and /i).forEach((piece) => {
        if (piece.trim().length > 3) {
          tasks.push({
            title: piece.trim(),
            priority: TaskPriority.MEDIUM,
            estimatedMinutes: 45,
          });
        }
      });
    }

    const actions: AIAction[] = [
      {
        type: "CREATE_PROJECT",
        description: `Create project "New Extracted Project"`,
        data: {
          name: "New Extracted Project",
          description: text,
          tempId: "temp_proj_1",
        },
      },
      ...tasks.map((t, idx) => ({
        type: "CREATE_TASK" as const,
        description: `Create task: ${t.title}`,
        data: {
          ...t,
          projectId: "temp_proj_1",
          tempId: `temp_task_${idx + 1}`,
        },
      })),
    ];

    return {
      project: "New Extracted Project",
      tasks,
      notes: text,
      actions,
    };
  }

  async extractTaskFromText(text: string): Promise<TaskExtractionResult> {
    const titleMatch = text.match(/(?:task|do|need to|should|must)[\s:]*(.+?)(?:\.|$)/i);
    const deadlineMatch = text.match(/(?:by|due|deadline|until)[\s:]*(.+?)(?:\.|$)/i);
    const priorityMatch = text.match(/(?:urgent|critical|high priority|asap)/i);

    let deadline: Date | undefined = undefined;
    if (deadlineMatch) {
      const parsed = Date.parse(deadlineMatch[1]);
      if (!isNaN(parsed)) deadline = new Date(parsed);
    }

    return {
      title: titleMatch ? titleMatch[1].trim() : text.slice(0, 60),
      description: text,
      deadline,
      priority: priorityMatch ? TaskPriority.HIGH : TaskPriority.MEDIUM,
      estimatedMinutes: 45,
      confidence: 0.75,
    };
  }

  async extractFromImage(_imageBase64: string, imageType?: string): Promise<TaskExtractionResult> {
    return {
      title: `Captured ${imageType || "Image"} Item`,
      description: "Image captured. Configure a real vision-capable LLM provider for image understanding.",
      priority: TaskPriority.MEDIUM,
      estimatedMinutes: 30,
      confidence: 0.35,
    };
  }

  async extractFromDocument(
    documentContent: string,
    _fileName: string
  ): Promise<DocumentExtractionResult> {
    const lines = documentContent.split("\n").filter((l) => l.trim());
    return {
      summary: lines.slice(0, 3).join(" "),
      keyPoints: lines.slice(0, 5),
      actionItems: lines.filter((l) => l.includes("-") || l.includes("•")).slice(0, 5),
      decisions: [],
    };
  }

  async generateTaskRecommendation(context: AIUserContext): Promise<{
    reason: string;
    whyThisTask: string;
    riskIfDelayed: string;
    expectedTime: string;
    blockersExplanation: string;
    nextAfterThis?: string;
  }> {
    const active = context.activeTasks.filter((t) => !t.isBlocked);
    if (active.length === 0) {
      return {
        reason: "No unblocked actionable tasks available.",
        whyThisTask: "All active tasks are either blocked by dependencies or completed.",
        riskIfDelayed: "None currently.",
        expectedTime: "0 min",
        blockersExplanation: "Unblock prerequisite tasks first.",
      };
    }

    const top = active[0];
    const unblocksCount = top.unblocks ? top.unblocks.length : 0;

    return {
      reason: `Top priority actionable task with upcoming timeline.`,
      whyThisTask: `"${top.title}" is ranked highest by priority (${top.priority}) and deadline urgency.${unblocksCount > 0 ? ` Completing it unblocks ${unblocksCount} downstream task(s).` : ""}`,
      riskIfDelayed: top.deadline ? `Delaying risks missing deadline on ${new Date(top.deadline).toLocaleDateString()}.` : `Delaying slows down overall project momentum.`,
      expectedTime: `${top.estimatedMinutes || 45} minutes estimated focus session`,
      blockersExplanation: `Ready to execute immediately (no pending blockers).`,
      nextAfterThis: active[1] ? active[1].title : undefined,
    };
  }

  async generateInsights(context: AIUserContext): Promise<AIProductivityInsight[]> {
    const insights: AIProductivityInsight[] = [];

    if (context.overdueTasksCount > 0) {
      insights.push({
        title: "Overdue Workload Alert",
        insight: `You currently have ${context.overdueTasksCount} overdue task(s) needing attention.`,
        type: "WARNING",
        metricSource: `${context.overdueTasksCount} overdue items in database`,
        actionableSuggestion: "Reschedule or complete overdue items first to clear backlog.",
      });
    }

    const blockedCount = context.activeTasks.filter((t) => t.isBlocked).length;
    if (blockedCount > 0) {
      insights.push({
        title: "Dependency Bottleneck Detected",
        insight: `${blockedCount} task(s) are waiting on prerequisite items.`,
        type: "WARNING",
        metricSource: `${blockedCount} blocked tasks in dependency graph`,
        actionableSuggestion: "Focus on finishing blocking prerequisites to unblock downstream work.",
      });
    }

    if (context.completedTasksCount > 0) {
      insights.push({
        title: "Productivity Velocity",
        insight: `You have completed ${context.completedTasksCount} task(s) so far.`,
        type: "SUCCESS",
        metricSource: `${context.completedTasksCount} completed tasks`,
        actionableSuggestion: "Keep momentum going with time-blocked focus sessions.",
      });
    }

    return insights;
  }

  async breakdownTask(
    taskTitle: string,
    description?: string,
    _context?: AIUserContext
  ): Promise<AITaskBreakdown> {
    const cleanTitle = taskTitle.replace(/^break\s+down\s+/i, "").trim();
    const subtasks = [
      {
        title: `Research & Requirements for ${cleanTitle}`,
        description: `Define scope, clarify constraints, and draft execution roadmap for "${cleanTitle}".`,
        estimatedMinutes: 25,
        priority: TaskPriority.MEDIUM,
        dependsOnPrevious: false,
      },
      {
        title: `Core Execution: ${cleanTitle}`,
        description: description || `Execute primary components and core milestones for "${cleanTitle}".`,
        estimatedMinutes: 60,
        priority: TaskPriority.HIGH,
        dependsOnPrevious: true,
      },
      {
        title: `Testing & Quality Review for ${cleanTitle}`,
        description: `Verify deliverables, polish details, and prepare final handover.`,
        estimatedMinutes: 20,
        priority: TaskPriority.MEDIUM,
        dependsOnPrevious: true,
      },
    ];

    const actions: AIAction[] = subtasks.map((st) => ({
      type: "CREATE_TASK",
      description: `Create subtask: ${st.title}`,
      data: {
        title: st.title,
        description: st.description,
        estimatedMinutes: st.estimatedMinutes,
        priority: st.priority,
      },
    }));

    return {
      originalTask: taskTitle,
      subtasks,
      actions,
      provider: "local_fallback",
      isFallback: true,
    };
  }

  async estimateDuration(
    taskTitle: string,
    description?: string,
    context?: AIUserContext
  ): Promise<{ estimatedMinutes: number; confidence: number; rationale: string }> {
    const text = `${taskTitle} ${description || ""}`.toLowerCase();
    let mins = 45;
    let confidence = 0.75;
    let rationale = "Rule-based complexity heuristic applied.";

    if (text.includes("quick") || text.includes("email") || text.includes("call") || text.includes("review")) {
      mins = 20;
      rationale = "Task categorized as rapid administrative/communication item.";
    } else if (text.includes("design") || text.includes("mockup") || text.includes("prototype") || text.includes("ui")) {
      mins = 90;
      rationale = "Creative design tasks typically require multi-phase deep focus.";
    } else if (text.includes("build") || text.includes("implement") || text.includes("refactor") || text.includes("backend") || text.includes("api")) {
      mins = 120;
      rationale = "Engineering and implementation tasks estimated for deep development.";
    } else if (text.includes("report") || text.includes("essay") || text.includes("paper") || text.includes("document")) {
      mins = 60;
      rationale = "Structured writing and documentation item.";
    }

    if (context?.recentFocusSessions && context.recentFocusSessions.length > 0) {
      const avgPast =
        context.recentFocusSessions.reduce((acc, s) => acc + s.durationMinutes, 0) /
        context.recentFocusSessions.length;
      confidence = 0.85;
      rationale += ` Corroborated with your average past session duration (~${Math.round(avgPast)}m).`;
    }

    return {
      estimatedMinutes: mins,
      confidence,
      rationale,
    };
  }

  async generateProjectReview(
    projectId: string,
    projectName: string,
    tasks: any[] = [],
    _context?: AIUserContext
  ): Promise<AIProjectReview> {
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const completedCount = safeTasks.filter((t) => t.status === "COMPLETED").length;
    const totalCount = safeTasks.length;
    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const remainingMins = safeTasks
      .filter((t) => t.status !== "COMPLETED")
      .reduce((acc, t) => acc + (t.estimatedMinutes || 30), 0);

    const blockedTasks = safeTasks.filter(
      (t) => Array.isArray(t.blockedBy) && t.blockedBy.some((b: any) => b.fromTask?.status !== "COMPLETED")
    );

    let healthStatus: "HEALTHY" | "AT_RISK" | "BLOCKED" | "ON_TRACK" = "ON_TRACK";
    const bottlenecks: string[] = [];
    const recommendations: string[] = [];

    if (blockedTasks.length > 0) {
      healthStatus = "BLOCKED";
      bottlenecks.push(`${blockedTasks.length} task(s) are blocked by uncompleted prerequisites.`);
      recommendations.push("Prioritize finishing blocking dependencies to clear workflow stalls.");
    }

    if (pct < 50 && remainingMins > 180) {
      if (healthStatus !== "BLOCKED") healthStatus = "AT_RISK";
      bottlenecks.push(`Heavy remaining workload (${Math.round(remainingMins / 60)}h ${remainingMins % 60}m) with <50% completion.`);
      recommendations.push("Break large remaining tasks into smaller 30-minute focus blocks.");
    } else if (pct >= 80) {
      healthStatus = "HEALTHY";
      recommendations.push("Project is near completion. Conduct final verification and polish.");
    }

    if (recommendations.length === 0) {
      recommendations.push("Keep current momentum with scheduled daily focus sessions.");
    }

    const criticalPath = safeTasks
      .filter((t) => t.priority === "CRITICAL" || t.priority === "HIGH")
      .slice(0, 3)
      .map((t) => t.title);

    return {
      projectId,
      projectName,
      healthStatus,
      healthPercentage: pct,
      executiveSummary: `Project "${projectName}" has ${completedCount}/${totalCount} tasks completed (${pct}%). ${
        healthStatus === "BLOCKED"
          ? "Critical dependency bottlenecks require immediate attention."
          : healthStatus === "AT_RISK"
          ? "Execution pace should be increased to meet timeline."
          : "Execution is progressing steadily."
      }`,
      bottlenecks,
      recommendations,
      criticalPath,
      estimatedRemainingMinutes: remainingMins,
      provider: "local_fallback",
      isFallback: true,
    };
  }

  async generateDailyBriefing(context: any): Promise<AIDailyBriefing> {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const activeTasks: any[] = context?.activeTasks || context?.tasks || [];

    const dueToday = activeTasks.filter((t) => {
      if (!t.deadline && !t.dueDate) return false;
      const target = t.deadline || t.dueDate;
      const d = typeof target === "string" ? target : new Date(target).toISOString();
      return d.startsWith(todayStr);
    });

    const overdue = activeTasks.filter((t) => {
      const target = t.deadline || t.dueDate;
      if (!target) return false;
      return new Date(target).getTime() < now.getTime();
    });

    const blocked = activeTasks.filter((t) => t.isBlocked || (Array.isArray(t.blockers) && t.blockers.length > 0));
    const unblocked = activeTasks.filter((t) => !t.isBlocked && (!Array.isArray(t.blockers) || t.blockers.length === 0));
    const totalEstMins = activeTasks.reduce((acc, t) => acc + (t.estimatedMinutes || 30), 0);
    const estWorkHours = parseFloat((totalEstMins / 60).toFixed(1));
    const available = context?.availableHoursTonight || context?.availableHours || 4;

    const topTask = unblocked[0] || activeTasks[0] || null;
    const topAction = topTask
      ? {
          title: topTask.title,
          why: topTask.priority === "CRITICAL" || topTask.priority === "HIGH"
            ? `Top priority item (${topTask.priority}) with immediate execution readiness.`
            : "Next available unblocked task on your execution queue.",
          unlocks: topTask.unblocks && topTask.unblocks.length > 0
            ? topTask.unblocks.map((u: any) => u.title).join(", ")
            : undefined,
        }
      : null;

    const suggestedSchedule = unblocked.slice(0, 3).map((t, idx) => {
      const startHour = 9 + idx * 2;
      const endHour = startHour + Math.max(1, Math.round((t.estimatedMinutes || 60) / 60));
      return {
        timeSlot: `${String(startHour).padStart(2, "0")}:00 - ${String(endHour).padStart(2, "0")}:00`,
        taskTitle: t.title,
        durationMinutes: t.estimatedMinutes || 60,
      };
    });

    const deadlineAlerts = activeTasks
      .filter((t) => t.deadline || t.dueDate)
      .slice(0, 3)
      .map((t) => {
        const target = t.deadline || t.dueDate;
        return {
          title: t.title,
          deadline: new Date(target!).toLocaleDateString(),
          urgency: new Date(target!).getTime() < now.getTime() ? ("CRITICAL" as const) : ("HIGH" as const),
        };
      });

    return {
      greeting: now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening",
      summary: `You have ${activeTasks.length} active tasks (${overdue.length} overdue, ${blocked.length} blocked). Estimated workload is ${estWorkHours}h against ${available}h available capacity.`,
      totalTasksToday: activeTasks.length,
      dueTodayCount: dueToday.length,
      overdueCount: overdue.length,
      blockedCount: blocked.length,
      estimatedWorkHours: estWorkHours,
      availableHours: available,
      topAction,
      suggestedSchedule,
      deadlineAlerts,
      provider: "local_fallback",
      isFallback: true,
    };
  }

  async generateWeeklyReview(context: any): Promise<AIWeeklyReview> {
    const completedCount = context?.completedTasksCount || (Array.isArray(context?.completedTasks) ? context.completedTasks.length : 0);
    const overdueCount = context?.overdueTasksCount || (Array.isArray(context?.overdueTasks) ? context.overdueTasks.length : 0);
    const projects = context?.projects || [];

    const score = Math.max(40, Math.min(98, Math.round(
      (completedCount * 10) - (overdueCount * 8) + 60
    )));

    return {
      summary: `In this cycle you finished ${completedCount} tasks with ${overdueCount} overdue items requiring resolution.`,
      completionVelocity: `${completedCount} tasks completed`,
      topBottleneckProject: projects[0]?.name,
      actionableChanges: [
        "Dedicate the first 90 minutes of your day to unblocked high-priority items.",
        "Split tasks with estimated duration over 2 hours into smaller subtasks.",
        "Resolve dependency prerequisites before starting downstream milestones.",
      ],
      productivityScore: score,
      provider: "local_fallback",
      isFallback: true,
    };
  }
}

/**
 * Factory for creating AI Provider
 */
export class AIProviderFactory {
  static create(providerName?: string, apiKey?: string, model?: string): AIProvider {
    const requested = (providerName || process.env.AI_PROVIDER || "local").toLowerCase();
    const configuredModel = model || process.env.AI_MODEL || (requested === "xkiro" ? "minimax/minimax-m3:free" : "gpt-4o-mini");

    if (requested === "xkiro") {
      const key = apiKey || process.env.XKIRO_API_KEY;
      if (key) {
        logger.info("Initialized XKiroProvider with model minimax/minimax-m3:free");
        return new XKiroProvider(key);
      }
      logger.warn("xKiro provider requested but XKIRO_API_KEY is not set. Falling back to LocalAIProvider.");
      return new LocalAIProvider();
    }

    const key = apiKey || process.env.OPENAI_API_KEY;

    if (requested === "openai" || key) {
      if (key) {
        logger.info(`Initialized Real OpenAIProvider with model ${configuredModel}`);
        return new OpenAIProvider(key, configuredModel);
      }
      logger.warn("OpenAI provider requested but OPENAI_API_KEY is not set. Falling back to LocalAIProvider.");
    }

    logger.info(`Initialized LocalAIProvider (Deterministic Local Fallback; OPENAI_API_KEY=${key ? "set" : "missing"})`);
    return new LocalAIProvider();
  }
}

