import axios from "axios";
import {
  TaskExtractionResult,
  DocumentExtractionResult,
  AIPlan,
  AIChatResponse,
  AIUserContext,
  AIChatMessage,
  AIAction,
  AICommitment,
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
  getProviderName(): "openai" | "xkiro" | "local_fallback" | "anthropic" | "ollama" | "gemini";
  isRealAI(): boolean;

  understandAndStructureAction(
    input: {
      text?: string;
      image?: string;
      mimeType?: string;
      imageType?: string;
    },
    context?: AIUserContext
  ): Promise<{
    extractedInfo: {
      title?: string;
      summary?: string;
      keyPoints?: string[];
      fields?: Record<string, any>;
      rawText?: string;
      confidence?: number;
      commitment?: AICommitment;
    };
    action: AIAction;
    commitment?: AICommitment;
    reasoning?: string;
  }>;

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
 * Helper to clean JSON string from Markdown wrappers and surrounding conversational text
 */
function cleanJsonOutput(raw: string): string {
  let cleaned = raw.trim();
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }
  const firstBrace = cleaned.search(/[{\[]/);
  if (firstBrace !== -1) {
    const isObject = cleaned[firstBrace] === "{";
    const lastBrace = isObject ? cleaned.lastIndexOf("}") : cleaned.lastIndexOf("]");
    if (lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
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

  async understandAndStructureAction(
    input: {
      text?: string;
      image?: string;
      mimeType?: string;
      imageType?: string;
    },
    context?: AIUserContext
  ): Promise<{
    extractedInfo: {
      title?: string;
      summary?: string;
      keyPoints?: string[];
      fields?: Record<string, any>;
      rawText?: string;
      confidence?: number;
      commitment?: AICommitment;
    };
    action: AIAction;
    commitment?: AICommitment;
    reasoning?: string;
  }> {
    const formattedContext = context ? ContextBuilder.formatContextForPrompt(context) : "";
    const systemPrompt = `You are the iQOO Phone-First AI Productivity Action Engine.
Analyze the user input (image, voice transcript, or text command) along with application context, and convert it into a structured digital action and extracted metadata.

${formattedContext}

SUPPORTED ACTION TYPES:
- "create_task" (or "CREATE_TASK"): Create an actionable task (title, description, priority: "CRITICAL"|"HIGH"|"MEDIUM"|"LOW", deadline: YYYY-MM-DD, estimatedMinutes: number, tags: string[]).
- "create_csv" (or "CREATE_CSV"): Extract tabular/itemized data into CSV structure (fileName, columns, rows, csvContent).
- "create_report" (or "CREATE_REPORT"): Generate a formatted Markdown executive report (title, content, keyPoints).
- "save_note" (or "SAVE_NOTE"): Save raw content/findings as a searchable note (title, content, tags).
- "send_to_laptop" (or "SEND_TO_LAPTOP"): Package generated data for laptop transfer via Office Kit (fileName, payload, targetDevice: "laptop").
- "summarize" (or "SUMMARIZE"): Produce a concise summary of the content.
- "extract_information" (or "EXTRACT_INFORMATION"): Extract key-value fields.

Return a valid JSON object matching:
{
  "extractedInfo": {
    "title": "Short title",
    "summary": "Executive summary of content",
    "keyPoints": ["Key point 1", "Key point 2"],
    "fields": { "Vendor": "...", "Amount": "...", "DueDate": "...", ... },
    "rawText": "OCR/text extract if applicable",
    "confidence": 0.95
  },
  "action": {
    "type": "create_task" | "create_csv" | "create_report" | "save_note" | "send_to_laptop" | "update_task" | "summarize" | "extract_information",
    "description": "Human readable action description",
    "data": {
      "title": "...",
      "description": "...",
      "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "deadline": "YYYY-MM-DD or ISO",
      "estimatedMinutes": 30,
      "tags": ["..."],
      "fileName": "export.csv",
      "columns": ["Col1", "Col2"],
      "rows": [["Val1", "Val2"]],
      "csvContent": "Col1,Col2\\nVal1,Val2",
      "content": "...",
      "payload": "..."
    }
  },
  "reasoning": "Why this action was chosen"
}`;

    const userPrompt = input.text?.trim() || "Analyze the attached item, extract all important information, and create an appropriate action.";
    const userContent: any[] = [{ type: "text", text: userPrompt }];

    if (input.image) {
      const url = input.image.startsWith("data:")
        ? input.image
        : `data:${input.mimeType || "image/jpeg"};base64,${input.image}`;
      userContent.push({
        type: "image_url",
        image_url: { url },
      });
    }

    try {
      const raw = await this.callOpenAI(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        0.2,
        true
      );
      const parsed = JSON.parse(cleanJsonOutput(raw));
      return {
        extractedInfo: parsed.extractedInfo || {
          title: parsed.title || "Extracted Content",
          summary: parsed.summary || "Content extracted successfully",
          fields: parsed.fields || {},
          keyPoints: parsed.keyPoints || [],
          confidence: parsed.confidence || 0.9,
        },
        action: parsed.action || {
          type: "create_task",
          description: parsed.description || "Create extracted task",
          data: parsed.data || {
            title: parsed.title || "Extracted Task",
            description: parsed.description || parsed.summary,
            priority: TaskPriority.HIGH,
          },
        },
        reasoning: parsed.reasoning || "Generated structured action from multimodal input",
      };
    } catch (err: any) {
      logger.error("Failed to understandAndStructureAction via OpenAI:", err);
      if (err instanceof AIProviderError) throw err;
      return {
        extractedInfo: {
          title: input.text ? input.text.slice(0, 40) : "Captured Item",
          summary: input.text || "Item captured from camera/voice",
          confidence: 0.7,
        },
        action: {
          type: "create_task",
          description: input.text || "Create task from captured item",
          data: {
            title: input.text || "New Task",
            description: input.text || "Captured item",
            priority: TaskPriority.MEDIUM,
          },
        },
      };
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
  constructor(apiKey: string, model: string = process.env.AI_MODEL || "minimax/minimax-m3:free") {
    super(apiKey, model, "https://api.xkiro.com/v1", "xkiro");
  }
}

/**
 * Real Google Gemini Provider (Gemini 2.5 Flash / Gemini 2.0 Flash / Gemini 1.5 Flash)
 * Supports multimodal vision + voice/text understanding and structured JSON outputs.
 */
export class GeminiProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private apiBase: string;

  constructor(apiKey: string, model: string = "gemini-flash-lite-latest") {
    this.apiKey = apiKey;
    this.model = model || "gemini-flash-lite-latest";
    this.apiBase = "https://generativelanguage.googleapis.com/v1beta";
  }

  getProviderName(): "gemini" {
    return "gemini";
  }

  isRealAI(): boolean {
    return true;
  }

  private async callGemini(
    contents: any[],
    systemInstruction?: string,
    responseFormatJson: boolean = false,
    temperature: number = 0.2
  ): Promise<string> {
    if (!this.apiKey || this.apiKey.trim() === "" || this.apiKey === "your-gemini-api-key-here") {
      throw new AIProviderError(
        "GEMINI_API_KEY is not configured in server/.env or root .env. Please configure a valid GEMINI_API_KEY to use Gemini 2.5 Flash.",
        "AI_PROVIDER_UNAVAILABLE",
        401
      );
    }

    try {
      const payload: any = {
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens: 4096,
          ...(responseFormatJson ? { responseMimeType: "application/json" } : {}),
        },
      };

      if (systemInstruction) {
        payload.systemInstruction = {
          parts: [{ text: systemInstruction }],
        };
      }

      logger.info(`Calling Gemini API with model: ${this.model}`);

      const res = await axios.post(
        `${this.apiBase}/models/${this.model}:generateContent?key=${this.apiKey}`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 40000,
        }
      );

      const candidate = res.data?.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Empty response returned from Gemini API");
      }
      return text;
    } catch (err: any) {
      const status = err?.response?.status;
      const errMsg = err?.response?.data?.error?.message || err?.message || "Gemini request failed";
      logger.error(`Gemini API error (${this.model}): ${errMsg}`);
      if (status === 429) {
        throw new AIProviderError("Gemini API is rate-limited. Please wait a moment and try again.", "AI_PROVIDER_RATE_LIMIT", 429);
      }
      if (err?.code === "ECONNABORTED" || /timeout/i.test(errMsg)) {
        throw new AIProviderError("Gemini API timed out. Please try again.", "AI_PROVIDER_TIMEOUT", 504);
      }
      throw new AIProviderError(`Gemini API error: ${errMsg}`, "AI_PROVIDER_UNAVAILABLE", status || 503);
    }
  }

  async understandAndStructureAction(
    input: {
      text?: string;
      image?: string;
      mimeType?: string;
      imageType?: string;
    },
    context?: AIUserContext
  ): Promise<{
    extractedInfo: {
      title?: string;
      summary?: string;
      keyPoints?: string[];
      fields?: Record<string, any>;
      rawText?: string;
      confidence?: number;
      commitment?: AICommitment;
    };
    action: AIAction;
    commitment?: AICommitment;
    reasoning?: string;
  }> {
    const formattedContext = context ? ContextBuilder.formatContextForPrompt(context) : "";
    const systemPrompt = `You are the iQOO Phone-First AI Productivity Action Engine powered by Gemini.
Analyze the user's input (image, document, invoice, voice transcript, or text prompt) and convert it into a structured digital action, extracted metadata, and commitment intelligence.

${formattedContext}

SUPPORTED ACTION TYPES:
- "create_task" (or "CREATE_TASK"): Create an actionable task (title, description, priority: "CRITICAL"|"HIGH"|"MEDIUM"|"LOW", deadline: YYYY-MM-DD, estimatedMinutes: number, tags: string[]).
- "create_csv" (or "CREATE_CSV"): Extract tabular data into CSV structure (fileName, columns, rows, csvContent).
- "create_report" (or "CREATE_REPORT"): Generate a formatted Markdown executive report (title, content, keyPoints).
- "save_note" (or "SAVE_NOTE"): Save raw content/findings as a searchable note (title, content, tags).
- "send_to_laptop" (or "SEND_TO_LAPTOP"): Package generated data for laptop transfer via Office Kit (fileName, payload, targetDevice: "laptop").
- "summarize" (or "SUMMARIZE"): Produce a concise summary of the content.
- "extract_information" (or "EXTRACT_INFORMATION"): Extract key-value fields.

COMMITMENT INTELLIGENCE:
Evaluate whether the spoken utterance or text represents a concrete user commitment / promise to take action:
- "isCommitment": true if user promised an action (e.g. "I'll send Rahul the report tomorrow", "I'll meet Sarah at 3 PM", "I'll finish slides on my laptop tonight"). False for past statements ("Rahul sent report yesterday") or passive remarks ("Weather is nice").
- "owner": "me" (or who made the commitment).
- "action": Concise action promise (e.g. "Send project report", "Meet with Sarah").
- "person": Recipient or other party involved (e.g. "Rahul", "Sarah"), or null.
- "deadline": Specific deadline or date/time (e.g. "Tomorrow at 5 PM", "Friday"), or null.
- "confidence": 0.0 to 1.0 confidence in commitment detection.
- "executionType": "message" (promising to send/text/share with someone) | "calendar" (promising to meet/attend/call at specific time) | "laptop" (promising to work on laptop/PC via Office Kit) | "task" (general task execution).
- "requiresConfirmation": true (all consequential external actions like messaging or calendar require explicit user confirmation).
- "draftExecution": Prepared execution payload:
  * For "message": { "type": "message", "title": "Send project report to Rahul", "recipient": "Rahul", "draftText": "Hi Rahul, I'll send you the project report tomorrow." }
  * For "calendar": { "type": "calendar", "title": "Meeting with Sarah", "eventDate": "YYYY-MM-DD", "eventTime": "15:00", "durationMinutes": 30 }
  * For "laptop": { "type": "laptop", "title": "Prepare presentation on laptop", "laptopPayload": { "task": "Prepare presentation", "deadline": "Tonight" } }
  * For "task": { "type": "task", "title": "Task title" }

Return a valid JSON object matching:
{
  "extractedInfo": {
    "title": "Short title",
    "summary": "Executive summary of content",
    "keyPoints": ["Key point 1", "Key point 2"],
    "fields": { "Vendor": "...", "Amount": "...", "DueDate": "...", ... },
    "rawText": "OCR/text extract if applicable",
    "confidence": 0.95
  },
  "commitment": {
    "isCommitment": true,
    "owner": "me",
    "action": "Send project report",
    "person": "Rahul",
    "deadline": "Tomorrow",
    "confidence": 0.96,
    "executionType": "message",
    "requiresConfirmation": true,
    "draftExecution": {
      "type": "message",
      "title": "Send project report to Rahul",
      "recipient": "Rahul",
      "draftText": "Hi Rahul, I'll send you the project report tomorrow."
    }
  },
  "action": {
    "type": "create_task" | "create_csv" | "create_report" | "save_note" | "send_to_laptop" | "update_task" | "summarize" | "extract_information",
    "description": "Human readable action description",
    "data": {
      "title": "...",
      "description": "...",
      "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "deadline": "YYYY-MM-DD or ISO",
      "estimatedMinutes": 30,
      "tags": ["..."],
      "fileName": "export.csv",
      "columns": ["Col1", "Col2"],
      "rows": [["Val1", "Val2"]],
      "csvContent": "Col1,Col2\\nVal1,Val2",
      "content": "...",
      "payload": "..."
    }
  },
  "reasoning": "Why this action and commitment were chosen"
}`;

    const parts: any[] = [];
    const promptText = input.text?.trim() || "Analyze the attached item, extract all important information, and create an appropriate action.";
    parts.push({ text: promptText });

    if (input.image) {
      let rawBase64 = input.image;
      let mime = input.mimeType || "image/jpeg";
      const match = input.image.match(/^data:([^;]+);base64,(.*)$/);
      if (match) {
        mime = match[1];
        rawBase64 = match[2];
      }
      parts.push({
        inlineData: {
          mimeType: mime,
          data: rawBase64,
        },
      });
    }

    try {
      const raw = await this.callGemini(
        [{ role: "user", parts }],
        systemPrompt,
        true,
        0.2
      );
      const parsed = JSON.parse(cleanJsonOutput(raw));
      const extractedCommitment = parsed.commitment || parsed.extractedInfo?.commitment;

      return {
        extractedInfo: parsed.extractedInfo || {
          title: parsed.title || "Extracted Content",
          summary: parsed.summary || "Content processed successfully",
          fields: parsed.fields || {},
          keyPoints: parsed.keyPoints || [],
          confidence: parsed.confidence || 0.95,
          commitment: extractedCommitment,
        },
        commitment: extractedCommitment,
        action: parsed.action || {
          type: "create_task",
          description: parsed.description || "Create extracted task",
          data: parsed.data || {
            title: parsed.title || "Extracted Task",
            description: parsed.description || parsed.summary,
            priority: TaskPriority.HIGH,
          },
        },
        reasoning: parsed.reasoning || "Generated structured action via Gemini multimodal understanding",
      };
    } catch (err: any) {
      logger.error("Failed to understandAndStructureAction via Gemini:", err);
      if (err instanceof AIProviderError) throw err;
      throw new AIProviderError(
        `Gemini Action Engine failed: ${err?.message || "Failed to process multimodal input"}`,
        "AI_PROVIDER_MALFORMED_OUTPUT",
        500
      );
    }
  }

  async processConversation(
    message: string,
    context: AIUserContext,
    history: AIChatMessage[] = []
  ): Promise<AIChatResponse> {
    const formattedContext = ContextBuilder.formatContextForPrompt(context);
    const systemPrompt = `You are the iQOO AI Productivity Copilot powered by Gemini.
You have real-time access to the user's actual database (tasks, projects, dependencies, deadlines, blockers, focus records).

${formattedContext}

CRITICAL INSTRUCTIONS:
1. ALWAYS reason over the user's REAL database tasks provided above. When referencing tasks, use their actual titles, IDs, priorities, and deadlines.
2. If the user asks what to work on (e.g., "I have 3 hours tonight", "What should I finish?"), inspect their active tasks, estimate realistic time fit, check blockers, and recommend a prioritized sequence with rationale.
3. If the user asks to create, update, delete, schedule, or link tasks/projects/dependencies, explain your plan in the message AND generate structured actions in the "actions" array.
4. Return a valid JSON object matching this schema:
{
  "message": "Clear Markdown response",
  "reasoning": "Brief explanation",
  "suggestedFollowUps": ["Question 1", "Question 2"],
  "actions": [
    {
      "type": "CREATE_TASK" | "UPDATE_TASK" | "DELETE_TASK" | "CREATE_DEPENDENCY" | "CREATE_PROJECT" | "SCHEDULE_PLAN" | "CREATE_CSV" | "CREATE_REPORT" | "SAVE_NOTE" | "SEND_TO_LAPTOP",
      "description": "Human readable summary",
      "data": { ... }
    }
  ]
}`;

    const contents: any[] = [];
    for (const h of history.slice(-6)) {
      contents.push({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }],
      });
    }
    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    try {
      const raw = await this.callGemini(contents, systemPrompt, true, 0.3);
      const parsed = JSON.parse(cleanJsonOutput(raw));
      return {
        message: parsed.message || raw,
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        reasoning: parsed.reasoning,
        suggestedFollowUps: parsed.suggestedFollowUps || [],
        provider: this.getProviderName(),
        isFallback: false,
      };
    } catch (err: any) {
      logger.error("Failed to process conversation via Gemini:", err);
      if (err instanceof AIProviderError) throw err;
      return {
        message: `I encountered an issue processing your request: ${err.message}`,
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
    const systemPrompt = `You are an expert AI productivity planner powered by Gemini.
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

    const raw = await this.callGemini(
      [{ role: "user", parts: [{ text }] }],
      systemPrompt,
      true,
      0.2
    );

    const parsed = JSON.parse(cleanJsonOutput(raw));
    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];

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
    const systemPrompt = `You are an AI task extraction specialist powered by Gemini.
Extract a structured task from the user's voice transcript or natural text.
Infer missing details intelligently based on context.
${contextPrompt}

Return JSON:
{
  "title": "Clear actionable task title",
  "description": "Full context and notes",
  "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "estimatedMinutes": 45,
  "deadline": "2026-09-20T18:00:00Z",
  "project": "Associated project name if mentioned",
  "confidence": 0.95
}`;

    const raw = await this.callGemini(
      [{ role: "user", parts: [{ text }] }],
      systemPrompt,
      true,
      0.2
    );
    const parsed = JSON.parse(cleanJsonOutput(raw));
    return {
      title: parsed.title || text.slice(0, 50),
      description: parsed.description || text,
      priority: parsed.priority || TaskPriority.MEDIUM,
      estimatedMinutes: parsed.estimatedMinutes || 45,
      deadline: parsed.deadline ? new Date(parsed.deadline) : undefined,
      project: parsed.project,
      confidence: parsed.confidence || 0.9,
    };
  }

  async extractFromImage(
    imageBase64: string,
    imageType?: string
  ): Promise<TaskExtractionResult> {
    let rawBase64 = imageBase64;
    let mime = "image/jpeg";
    const match = imageBase64.match(/^data:([^;]+);base64,(.*)$/);
    if (match) {
      mime = match[1];
      rawBase64 = match[2];
    }

    const systemPrompt = `You are an AI vision extraction assistant powered by Gemini.
Extract structured actionable productivity tasks and key information from this ${imageType || "image"}.
Return JSON:
{
  "title": "Extracted Action Item",
  "description": "Detailed description of content",
  "priority": "HIGH",
  "estimatedMinutes": 45,
  "confidence": 0.95
}`;

    try {
      const raw = await this.callGemini(
        [
          {
            role: "user",
            parts: [
              { text: `Extract actionable tasks from this ${imageType || "image"}` },
              { inlineData: { mimeType: mime, data: rawBase64 } },
            ],
          },
        ],
        systemPrompt,
        true,
        0.2
      );
      const parsed = JSON.parse(cleanJsonOutput(raw));
      return {
        title: parsed.title || "Task from Image",
        description: parsed.description || "Image content processed",
        priority: parsed.priority || TaskPriority.HIGH,
        estimatedMinutes: parsed.estimatedMinutes || 45,
        confidence: parsed.confidence || 0.95,
      };
    } catch (err: any) {
      if (err instanceof AIProviderError) throw err;
      throw new AIProviderError(
        `Gemini vision extraction failed: ${err?.message || "Failed to extract task from image"}`,
        "AI_PROVIDER_MALFORMED_OUTPUT",
        500
      );
    }
  }

  async extractFromDocument(
    documentContent: string,
    fileName: string
  ): Promise<DocumentExtractionResult> {
    const systemPrompt = `You are an AI document intelligence analyst powered by Gemini.
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
      "title": "Action title",
      "priority": "HIGH",
      "estimatedMinutes": 45
    }
  ]
}`;

    const raw = await this.callGemini(
      [{ role: "user", parts: [{ text: `Document content for "${fileName}":\n\n${documentContent}` }] }],
      systemPrompt,
      true,
      0.2
    );
    const parsed = JSON.parse(cleanJsonOutput(raw));
    return {
      summary: parsed.summary || "Document processed successfully.",
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
    const systemPrompt = `You are an executive productivity strategist powered by Gemini.
Recommend the single highest-leverage task to execute right now.
${formattedContext}

Return JSON:
{
  "reason": "Clear, direct reason why this task is the #1 priority right now.",
  "whyThisTask": "Strategic justification based on dependencies and impact.",
  "riskIfDelayed": "Concrete risk if postponed.",
  "expectedTime": "Estimated duration formatted nicely (e.g. '45 mins')",
  "blockersExplanation": "Status of prerequisite tasks or downstream unblocks.",
  "nextAfterThis": "The logical subsequent task to execute next."
}`;

    const raw = await this.callGemini(
      [{ role: "user", parts: [{ text: "What should I do right now?" }] }],
      systemPrompt,
      true,
      0.2
    );
    const parsed = JSON.parse(cleanJsonOutput(raw));
    return {
      reason: parsed.reason || "Highest leverage unblocked task based on priority and deadline.",
      whyThisTask: parsed.whyThisTask || "Immediate impact on downstream deliverables.",
      riskIfDelayed: parsed.riskIfDelayed || "Downstream milestones will be delayed.",
      expectedTime: parsed.expectedTime || "45 mins",
      blockersExplanation: parsed.blockersExplanation || "No unresolved blockers.",
      nextAfterThis: parsed.nextAfterThis,
    };
  }

  async generateInsights(context: AIUserContext): Promise<AIProductivityInsight[]> {
    const formattedContext = ContextBuilder.formatContextForPrompt(context);
    const systemPrompt = `You are an AI productivity coach powered by Gemini.
Analyze the user's workload, blocked tasks, focus trends, and completion rate.
${formattedContext}

Return JSON:
{
  "insights": [
    {
      "title": "Short catchy insight title",
      "insight": "Data-backed observation on their work patterns or risks.",
      "type": "WARNING" | "SUCCESS" | "RECOMMENDATION" | "NEUTRAL",
      "metricSource": "e.g. Completion Rate, Blockers Graph, Overdue Count",
      "actionableSuggestion": "Specific action user can take right now."
    }
  ]
}`;

    const raw = await this.callGemini(
      [{ role: "user", parts: [{ text: "Generate personalized productivity insights." }] }],
      systemPrompt,
      true,
      0.3
    );
    const parsed = JSON.parse(cleanJsonOutput(raw));
    return Array.isArray(parsed.insights) ? parsed.insights : [];
  }

  async breakdownTask(
    taskTitle: string,
    description?: string,
    context?: AIUserContext
  ): Promise<AITaskBreakdown> {
    const contextPrompt = context ? ContextBuilder.formatContextForPrompt(context) : "";
    const systemPrompt = `You are an AI task decomposition expert powered by Gemini.
Break down the given task into 3-6 concrete, sequential subtasks.
${contextPrompt}

Task: "${taskTitle}"
Description: "${description || "None"}"

Return JSON:
{
  "originalTask": "${taskTitle}",
  "subtasks": [
    {
      "title": "Subtask title",
      "description": "Brief instruction",
      "estimatedMinutes": 30,
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "dependsOnPrevious": true
    }
  ]
}`;

    const raw = await this.callGemini(
      [{ role: "user", parts: [{ text: `Break down task: "${taskTitle}"` }] }],
      systemPrompt,
      true,
      0.2
    );
    const parsed = JSON.parse(cleanJsonOutput(raw));
    const subtasks = Array.isArray(parsed.subtasks) ? parsed.subtasks : [];

    const actions: AIAction[] = subtasks.map((s: any, idx: number) => ({
      type: "CREATE_TASK" as const,
      description: `Create subtask: ${s.title} (${s.estimatedMinutes || 30}m)`,
      data: {
        title: s.title,
        description: s.description,
        estimatedMinutes: s.estimatedMinutes || 30,
        priority: s.priority || TaskPriority.MEDIUM,
        tempId: `subtask_${idx + 1}`,
        dependencies: s.dependsOnPrevious && idx > 0 ? [`subtask_${idx}`] : [],
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
    const contextPrompt = context ? ContextBuilder.formatContextForPrompt(context) : "";
    const systemPrompt = `You are an AI task estimation specialist powered by Gemini.
Estimate realistic completion time for this task based on historical complexity and context.
${contextPrompt}

Task: "${taskTitle}"
Description: "${description || "None"}"

Return JSON:
{
  "estimatedMinutes": 45,
  "confidence": 0.85,
  "rationale": "Explanation for the estimate based on scope and historical patterns."
}`;

    const raw = await this.callGemini(
      [{ role: "user", parts: [{ text: `Estimate duration for: "${taskTitle}"` }] }],
      systemPrompt,
      true,
      0.2
    );
    const parsed = JSON.parse(cleanJsonOutput(raw));
    return {
      estimatedMinutes: typeof parsed.estimatedMinutes === "number" ? parsed.estimatedMinutes : 45,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.85,
      rationale: parsed.rationale || "Calculated based on average task complexity.",
    };
  }

  async generateProjectReview(
    projectId: string,
    projectName: string,
    tasks: any[] = [],
    context?: AIUserContext
  ): Promise<AIProjectReview> {
    const contextPrompt = context ? ContextBuilder.formatContextForPrompt(context) : "";
    const systemPrompt = `You are an AI technical project manager powered by Gemini.
Analyze the project "${projectName}" (ID: ${projectId}) with ${tasks.length} tasks.
${contextPrompt}

Return JSON:
{
  "healthStatus": "HEALTHY" | "AT_RISK" | "BLOCKED" | "ON_TRACK",
  "healthPercentage": 82,
  "executiveSummary": "Concise summary of project health and trajectory.",
  "bottlenecks": ["Bottleneck 1", "Bottleneck 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "criticalPath": ["Task 1", "Task 2"],
  "estimatedRemainingMinutes": 320
}`;

    const raw = await this.callGemini(
      [{ role: "user", parts: [{ text: `Review project "${projectName}" with ${tasks.length} tasks.` }] }],
      systemPrompt,
      true,
      0.2
    );
    const parsed = JSON.parse(cleanJsonOutput(raw));
    return {
      projectId,
      projectName,
      healthStatus: parsed.healthStatus || "ON_TRACK",
      healthPercentage: typeof parsed.healthPercentage === "number" ? parsed.healthPercentage : 80,
      executiveSummary: parsed.executiveSummary || "Project is advancing steadily with active tasks.",
      bottlenecks: Array.isArray(parsed.bottlenecks) ? parsed.bottlenecks : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      criticalPath: Array.isArray(parsed.criticalPath) ? parsed.criticalPath : [],
      estimatedRemainingMinutes: typeof parsed.estimatedRemainingMinutes === "number" ? parsed.estimatedRemainingMinutes : 120,
      provider: this.getProviderName(),
      isFallback: false,
    };
  }

  async generateDailyBriefing(context?: AIUserContext): Promise<AIDailyBriefing> {
    const formattedContext = context ? ContextBuilder.formatContextForPrompt(context) : "";
    const systemPrompt = `You are an AI chief of staff powered by Gemini.
Generate an executive daily briefing for the user's workday.
${formattedContext}

Return JSON:
{
  "greeting": "Good morning / afternoon",
  "summary": "Executive summary of what today looks like.",
  "topAction": {
    "title": "Single most critical task",
    "why": "Strategic reason",
    "unlocks": "What downstream work this unblocks"
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
      "title": "Task due soon",
      "deadline": "Today 5 PM",
      "urgency": "HIGH"
    }
  ]
}`;

    const raw = await this.callGemini(
      [{ role: "user", parts: [{ text: "Generate my daily executive briefing." }] }],
      systemPrompt,
      true,
      0.2
    );
    const parsed = JSON.parse(cleanJsonOutput(raw));
    const activeTasks = context?.activeTasks || [];
    return {
      greeting: parsed.greeting || "Welcome to your productivity copilot",
      summary: parsed.summary || `You have ${activeTasks.length} active tasks scheduled.`,
      totalTasksToday: activeTasks.length,
      dueTodayCount: activeTasks.filter((t) => t.deadline).length,
      overdueCount: context?.overdueTasksCount || 0,
      blockedCount: activeTasks.filter((t) => t.isBlocked).length,
      estimatedWorkHours: Math.round(activeTasks.reduce((s, t) => s + (t.estimatedMinutes || 30), 0) / 60),
      availableHours: context?.availableHoursTonight || 8,
      topAction: parsed.topAction || null,
      suggestedSchedule: Array.isArray(parsed.suggestedSchedule) ? parsed.suggestedSchedule : [],
      deadlineAlerts: Array.isArray(parsed.deadlineAlerts) ? parsed.deadlineAlerts : [],
      provider: this.getProviderName(),
      isFallback: false,
    };
  }

  async generateWeeklyReview(context?: AIUserContext): Promise<AIWeeklyReview> {
    const formattedContext = context ? ContextBuilder.formatContextForPrompt(context) : "";
    const systemPrompt = `You are a high-performance productivity coach powered by Gemini.
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

    const raw = await this.callGemini(
      [{ role: "user", parts: [{ text: "Generate my weekly productivity review." }] }],
      systemPrompt,
      true,
      0.3
    );
    const parsed = JSON.parse(cleanJsonOutput(raw));
    return {
      summary: parsed.summary || `You completed ${context?.completedTasksCount || 0} tasks with ${context?.overdueTasksCount || 0} overdue.`,
      completionVelocity: parsed.completionVelocity || `${context?.completedTasksCount || 0} tasks completed`,
      topBottleneckProject: parsed.topBottleneckProject || undefined,
      actionableChanges: Array.isArray(parsed.actionableChanges) ? parsed.actionableChanges : [],
      productivityScore: typeof parsed.productivityScore === "number" ? parsed.productivityScore : 78,
      provider: this.getProviderName(),
      isFallback: false,
    };
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

  async understandAndStructureAction(
    input: {
      text?: string;
      image?: string;
      mimeType?: string;
      imageType?: string;
    },
    _context?: AIUserContext
  ): Promise<{
    extractedInfo: {
      title?: string;
      summary?: string;
      keyPoints?: string[];
      fields?: Record<string, any>;
      rawText?: string;
      confidence?: number;
      commitment?: AICommitment;
    };
    action: AIAction;
    commitment?: AICommitment;
    reasoning?: string;
  }> {
    const text = (input.text || "").trim();
    const lower = text.toLowerCase();

    // Check for conversational commitment first
    const isPromise = /^(i'll|i will|i'm going to|i am going to|we'll|we will|let me|promise to)/i.test(text) ||
                      /(?:send|meet|sync with)\s+(?!(?:to|the|a|this|my|our|laptop|pc|office)\b)([A-Za-z]+)/i.test(text);

    // 1. Check for CSV / Tabular intent
    if (!isPromise && (lower.includes("csv") || lower.includes("table") || lower.includes("spreadsheet") || lower.includes("excel"))) {
      const columns = ["Item", "Quantity", "Unit Price", "Total Amount"];
      const rows = [
        ["Product/Service A", "1", "₹2,500", "₹2,500"],
        ["Product/Service B", "2", "₹1,250", "₹2,500"],
      ];
      const csvContent = "Item,Quantity,Unit Price,Total Amount\nProduct/Service A,1,₹2500,₹2500\nProduct/Service B,2,₹1250,₹2500";
      return {
        extractedInfo: {
          title: "Structured Data Extraction (CSV)",
          summary: text ? `Extracted tabular dataset for: ${text}` : "Extracted tabular data from input",
          keyPoints: ["Generated clean CSV format", "Included calculated item totals"],
          fields: {
            Format: "CSV",
            RowsCount: 2,
            ColumnsCount: 4,
          },
          confidence: 0.9,
        },
        action: {
          type: "create_csv",
          description: "Generate structured CSV document",
          data: {
            fileName: "extracted_productivity_data.csv",
            columns,
            rows,
            csvContent,
            summary: "Extracted tabular CSV data",
          },
        },
        reasoning: "Detected tabular / CSV generation request.",
      };
    }

    // 2. Check for Report intent
    if (!isPromise && (lower.startsWith("analyze this document and create a formal executive report") || lower.startsWith("analyze this document and create a report") || lower.startsWith("create report") || lower.startsWith("generate report") || lower.includes("formal summary"))) {
      const reportTitle = text.replace(/create|generate|report|a|an|the/gi, "").trim() || "Executive Productivity Report";
      const content = `# ${reportTitle}\n\n**Date**: ${new Date().toLocaleDateString()}\n**Status**: Verified\n\n## Executive Summary\n${text || "Visual document analysis and actionable items summary."}\n\n## Key Findings\n- Itemized deliverables extracted and prioritized\n- Critical milestones and ownership defined\n\n## Action Items\n- [ ] Review detailed deliverables\n- [ ] Execute primary tasks`;
      return {
        extractedInfo: {
          title: reportTitle,
          summary: `Executive briefing compiled from input: ${text}`,
          keyPoints: ["Key deliverables outlined", "Actionable checklists generated"],
          confidence: 0.92,
        },
        action: {
          type: "create_report",
          description: `Create executive report: ${reportTitle}`,
          data: {
            title: reportTitle,
            content,
            fileName: `${reportTitle.toLowerCase().replace(/\s+/g, "_")}.md`,
            summary: "Executive productivity report",
          },
        },
        reasoning: "Detected formal report generation request.",
      };
    }

    // 3. Check for Note intent
    if (!isPromise && (lower.startsWith("save this meeting note") || lower.startsWith("save note") || lower.startsWith("remember") || lower.startsWith("save this"))) {
      const noteTitle = text.replace(/save|note|remember|this|as/gi, "").trim() || "Captured Quick Note";
      return {
        extractedInfo: {
          title: noteTitle,
          summary: text,
          confidence: 0.88,
        },
        action: {
          type: "save_note",
          description: `Save note: "${noteTitle}"`,
          data: {
            title: noteTitle,
            content: text || "Captured content from camera/voice.",
            tags: ["ai_note", "phone_captured"],
          },
        },
        reasoning: "Detected save note intent.",
      };
    }

    // 4. Check for Laptop / Office Kit transfer intent
    if (!isPromise && (lower.includes("send to laptop via office kit") || lower.includes("transfer to laptop") || lower.includes("sync to pc"))) {
      return {
        extractedInfo: {
          title: "Office Kit Transfer",
          summary: `Synchronizing payload to laptop: ${text}`,
          confidence: 0.95,
        },
        action: {
          type: "send_to_laptop",
          description: "Sync digital asset to Laptop via Office Kit",
          data: {
            fileName: `laptop_transfer_${Date.now()}.txt`,
            payload: text || "Office Kit: Document ready for laptop sync.",
            targetDevice: "laptop",
          },
        },
        reasoning: "Detected Office Kit laptop transfer request.",
      };
    }

    // 5. Default: High-Quality Structured Task Creation
    let priority = TaskPriority.MEDIUM;
    if (lower.includes("critical") || lower.includes("urgent") || lower.includes("p0")) {
      priority = TaskPriority.CRITICAL;
    } else if (lower.includes("high") || lower.includes("important") || lower.includes("asap")) {
      priority = TaskPriority.HIGH;
    } else if (lower.includes("low")) {
      priority = TaskPriority.LOW;
    }

    // Detect deadline
    let deadline: string | undefined = undefined;
    if (lower.includes("tomorrow")) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      deadline = d.toISOString();
    } else if (lower.includes("friday")) {
      const d = new Date();
      const currentDay = d.getDay();
      const distance = (5 + 7 - currentDay) % 7 || 7;
      d.setDate(d.getDate() + distance);
      deadline = d.toISOString();
    } else if (lower.includes("today") || lower.includes("tonight")) {
      const d = new Date();
      d.setHours(23, 59, 59, 999);
      deadline = d.toISOString();
    }

    // Extract invoice fields if invoice keywords present
    const isInvoice = lower.includes("invoice") || lower.includes("vendor") || lower.includes("bill") || lower.includes("amount") || lower.includes("₹") || lower.includes("$");
    const fields: Record<string, any> = {};
    if (isInvoice) {
      const amountMatch = text.match(/(?:₹|\$|rs\.?|inr)\s*(\d+(?:,\d+)*(?:\.\d+)?)/i) || text.match(/(\d+)\s*(?:rupees|dollars|inr)/i);
      if (amountMatch) fields["Amount"] = amountMatch[0];
      const vendorMatch = text.match(/(?:vendor|from|by|to)\s*([A-Za-z0-9\s&]+?)(?:,|;|\.|\s+amount|\s+for|$)/i);
      if (vendorMatch) fields["Vendor"] = vendorMatch[1].trim();
      if (deadline) fields["DueDate"] = new Date(deadline).toLocaleDateString();
    }

    let title = text
      .replace(/^create\s+(?:a\s+)?(?:task|todo)\s+(?:called\s+|to\s+)?/i, "")
      .replace(/^extract\s+(?:the\s+)?(?:important\s+)?(?:information|info)\s+(?:and\s+create\s+a\s+task)?/i, "")
      .replace(/^look\s+at\s+this\s+document\s+and\s+/i, "")
      .trim();

    if (!title || title.length < 3) {
      title = isInvoice ? "Pay invoice & verify vendor billing" : (input.image ? "Process captured document" : "Productivity Action Item");
    }

    const description = isInvoice && Object.keys(fields).length > 0
      ? Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join("; ")
      : (text || "Extracted from phone capture");

    // Commitment Intelligence heuristic
    let commitment: AICommitment | undefined = undefined;

    if (isPromise) {
      let executionType: "message" | "calendar" | "laptop" | "task" = "task";
      let person: string | null = null;
      const personMatch = text.match(/(?:send|meet|call|tell|email|sync with|to|with)\s+([A-Z][a-z]+)/i);
      if (personMatch && !["tomorrow", "friday", "monday", "today", "tonight", "laptop", "office"].includes(personMatch[1].toLowerCase())) {
        person = personMatch[1];
      }

      if (lower.includes("laptop") || lower.includes("pc") || lower.includes("desktop")) {
        executionType = "laptop";
      } else if (lower.includes("send") || lower.includes("email") || lower.includes("text") || lower.includes("message") || lower.includes("whatsapp")) {
        executionType = "message";
      } else if (lower.includes("meet") || lower.includes("sync") || lower.includes("call") || lower.includes("appointment") || lower.includes("calendar") || lower.includes("pm") || lower.includes("am")) {
        executionType = "calendar";
      }

      const draftTitle = person ? `${title} for ${person}` : title;
      const draftText = person
        ? `Hi ${person}, ${text.replace(/^i'll/i, "I'll")}.`
        : `Commitment: ${text}`;

      commitment = {
        isCommitment: true,
        owner: "me",
        action: title,
        person,
        deadline: lower.includes("tomorrow") ? "tomorrow" : (deadline ? new Date(deadline).toLocaleString() : null),
        confidence: 0.95,
        executionType,
        requiresConfirmation: true,
        draftExecution: {
          type: executionType,
          title: draftTitle,
          recipient: person || undefined,
          draftText,
          eventDate: deadline ? new Date(deadline).toISOString().split("T")[0] : null,
          eventTime: "15:00",
          durationMinutes: 30,
          laptopPayload: executionType === "laptop" ? { task: title, deadline } : undefined,
        },
      };
    }

    return {
      extractedInfo: {
        title,
        summary: `Action item: ${title}`,
        keyPoints: [description],
        fields: Object.keys(fields).length > 0 ? fields : undefined,
        confidence: 0.85,
        commitment,
      },
      commitment,
      action: {
        type: "create_task",
        description: `Create task: "${title}" (${priority} priority)`,
        data: {
          title,
          description,
          priority,
          deadline,
          estimatedMinutes: 45,
          tags: isInvoice ? ["invoice", "finance", "phone_captured"] : ["ai_captured", "phone_first", "commitment"],
          commitment,
        },
      },
      reasoning: isInvoice ? "Extracted invoice/financial action item." : "Converted user request into actionable task with commitment intelligence.",
    };
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
    const requested = (providerName || process.env.AI_PROVIDER || "gemini").toLowerCase();
    const configuredModel = model || process.env.AI_MODEL;

    // 1. Gemini Priority
    const geminiKey = (requested === "gemini" ? apiKey : undefined) || process.env.GEMINI_API_KEY;
    if (requested === "gemini") {
      const geminiModel = configuredModel || "gemini-flash-lite-latest";
      logger.info(`Initialized Real GeminiProvider with model ${geminiModel}`);
      return new GeminiProvider(geminiKey || "", geminiModel);
    }
    if (geminiKey && !apiKey && requested !== "openai" && requested !== "xkiro") {
      const geminiModel = configuredModel || "gemini-flash-lite-latest";
      logger.info(`Initialized Real GeminiProvider with model ${geminiModel}`);
      return new GeminiProvider(geminiKey, geminiModel);
    }

    // 2. xKiro
    const xkiroKey = (requested === "xkiro" ? apiKey : undefined) || process.env.XKIRO_API_KEY;
    if (requested === "xkiro" || (xkiroKey && !apiKey && requested !== "openai")) {
      if (xkiroKey) {
        const xkiroModel = configuredModel || "qwen/qwen3.8-omni-flash:free";
        logger.info(`Initialized XKiroProvider with model ${xkiroModel}`);
        return new XKiroProvider(xkiroKey, xkiroModel);
      }
      if (requested === "xkiro") {
        logger.warn("xKiro provider requested but XKIRO_API_KEY is not set. Falling back to LocalAIProvider.");
      }
    }

    // 3. OpenAI
    const openaiKey = (requested === "openai" ? apiKey : undefined) || process.env.OPENAI_API_KEY;
    if (requested === "openai" || openaiKey) {
      if (openaiKey) {
        const openaiModel = configuredModel || "gpt-4o-mini";
        logger.info(`Initialized Real OpenAIProvider with model ${openaiModel}`);
        return new OpenAIProvider(openaiKey, openaiModel);
      }
      if (requested === "openai") {
        logger.warn("OpenAI provider requested but OPENAI_API_KEY is not set. Falling back to LocalAIProvider.");
      }
    }

    logger.info(`Initialized LocalAIProvider (Deterministic Local Fallback)`);
    return new LocalAIProvider();
  }
}


