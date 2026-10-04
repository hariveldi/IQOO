export enum TaskStatus {
  TODO = "TODO",
  IN_PROGRESS = "IN_PROGRESS",
  BLOCKED = "BLOCKED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum TaskPriority {
  CRITICAL = "CRITICAL",
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
}

export enum ActionInboxItemType {
  TASK = "TASK",
  NOTE = "NOTE",
  REMINDER = "REMINDER",
  DEADLINE = "DEADLINE",
  MEETING_ACTION = "MEETING_ACTION",
  DECISION = "DECISION",
  INFORMATION = "INFORMATION",
  FOLLOW_UP = "FOLLOW_UP",
}

export enum CaptureSource {
  VOICE = "VOICE",
  CAMERA = "CAMERA",
  DOCUMENT = "DOCUMENT",
  TEXT = "TEXT",
  MANUAL = "MANUAL",
}

// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// Task Types
export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline?: Date;
  estimatedMinutes?: number;
  actualMinutes?: number;
  projectId?: string;
  tags: string[];
  dependencies: string[]; // Array of task IDs
  reminders: Reminder[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  deadline?: Date;
  estimatedMinutes?: number;
  projectId?: string;
  tags?: string[];
  dependencies?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  deadline?: Date;
  estimatedMinutes?: number;
  actualMinutes?: number;
  tags?: string[];
  dependencies?: string[];
}

// Project Types
export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  color?: string;
}

// Reminder Types
export interface Reminder {
  id: string;
  taskId: string;
  reminderTime: Date;
  type: "TIME" | "DEADLINE" | "OVERDUE";
  sent: boolean;
  createdAt: Date;
}

// Action Inbox Types
export interface ActionInboxItem {
  id: string;
  userId: string;
  type: ActionInboxItemType;
  source: CaptureSource;
  rawContent: string;
  extractedData: Record<string, any>;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CONVERTED";
  convertedTaskId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// AI Extraction Types
export interface TaskExtractionResult {
  title: string;
  description?: string;
  deadline?: Date;
  priority?: TaskPriority;
  estimatedMinutes?: number;
  project?: string;
  people?: string[];
  dependencies?: string[];
  confidence?: number;
}

export interface DocumentExtractionResult {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  deadlines?: Date[];
  people?: string[];
  decisions?: string[];
  tasks?: TaskExtractionResult[];
}

// Focus Session Types
export interface FocusSession {
  id: string;
  userId: string;
  taskId: string;
  startTime: Date;
  endTime?: Date;
  plannedDuration: number; // minutes
  actualDuration?: number; // minutes
  paused: boolean;
  notes?: string;
}

// AI Response Types
export interface AIAssistantResponse {
  intent: string;
  confidence?: number;
  parameters?: Record<string, any>;
  explanation?: string;
}

// Productivity Scoring Types
export interface TaskScore {
  taskId: string;
  deadlineProximity: number; // 0-100
  importance: number; // 0-100
  effortEstimate: number; // 0-100
  dependencyBlockage: number; // 0-100
  projectImportance: number; // 0-100
  overdueStatus: number; // 0-100
  userPriority: number; // 0-100
  finalScore: number; // 0-100
  calculatedPriority: TaskPriority;
}

// Daily Plan Types
export interface ScheduleBlock {
  startTime: Date;
  endTime: Date;
  taskId: string;
  task?: Task;
  reason?: string;
}

export interface DailyPlan {
  userId: string;
  date: Date;
  blocks: ScheduleBlock[];
  totalPlannedMinutes: number;
  breaks: ScheduleBlock[];
}

// Analytics Types
export interface ProductivityMetrics {
  userId: string;
  period: "day" | "week" | "month";
  tasksCompleted: number;
  tasksOverdue: number;
  completionRate: number; // percentage
  totalTimeSpent: number; // minutes
  focusSessions: number;
  averageFocusTime: number; // minutes
  priorityDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  projectProgress: Record<string, number>; // project to completion %
}

// AI Actions & Context Types
export type AIActionType =
  | "CREATE_TASK"
  | "create_task"
  | "UPDATE_TASK"
  | "update_task"
  | "DELETE_TASK"
  | "delete_task"
  | "CREATE_DEPENDENCY"
  | "DELETE_DEPENDENCY"
  | "CREATE_PROJECT"
  | "SCHEDULE_PLAN"
  | "CREATE_CSV"
  | "create_csv"
  | "CREATE_REPORT"
  | "create_report"
  | "SAVE_NOTE"
  | "save_note"
  | "SUMMARIZE"
  | "summarize"
  | "EXTRACT_INFORMATION"
  | "extract_information"
  | "SEND_TO_LAPTOP"
  | "send_to_laptop";

export interface AIAction {
  id?: string;
  type: AIActionType;
  description: string;
  data: Record<string, any>;
}

export interface AICommitment {
  isCommitment: boolean;
  owner: string; // e.g. "me" or "You"
  action: string; // e.g. "Send project report"
  person?: string | null; // e.g. "Rahul"
  deadline?: string | null; // e.g. "Tomorrow at 5 PM"
  confidence: number; // e.g. 0.95
  executionType: "message" | "calendar" | "laptop" | "task";
  requiresConfirmation: boolean;
  draftExecution?: {
    type: "message" | "calendar" | "laptop" | "task";
    title: string;
    recipient?: string | null;
    draftText?: string;
    eventDate?: string | null;
    eventTime?: string | null;
    durationMinutes?: number;
    laptopPayload?: any;
    actionUri?: string;
  };
}

export interface AIActionPipelineInput {
  text?: string;
  image?: string;
  mimeType?: string;
  imageType?: string;
  autoExecute?: boolean;
}

export interface AIActionPipelineResult {
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
  executed: boolean;
  executionResult?: {
    task?: any;
    note?: any;
    document?: any;
    file?: {
      name: string;
      type: string;
      content: string;
      size: number;
      downloadUrl?: string;
    };
    officeKitSync?: {
      synced: boolean;
      fileName: string;
      destination: string;
      timestamp: string;
    };
    message?: string;
  };
  provider: string;
  isFallback: boolean;
}

export interface AIChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIUserContext {
  userId?: string;
  activeTasks: Array<{
    id: string;
    title: string;
    description?: string | null;
    status: string;
    priority: string;
    deadline?: Date | string | null;
    estimatedMinutes?: number | null;
    actualMinutes?: number | null;
    projectName?: string;
    projectId?: string | null;
    tags?: string[];
    isBlocked?: boolean;
    blockers?: Array<{ id: string; title: string; status: string }>;
    unblocks?: Array<{ id: string; title: string; status: string }>;
  }>;
  completedTasksCount: number;
  recentCompletedTasks?: Array<{
    id: string;
    title: string;
    priority: string;
    projectName?: string;
    estimatedMinutes?: number | null;
    actualMinutes?: number | null;
    createdAt: Date | string;
    updatedAt: Date | string;
  }>;
  overdueTasksCount: number;
  projects: Array<{
    id: string;
    name: string;
    description?: string | null;
    totalTasks: number;
    completedTasks: number;
  }>;
  recentFocusSessions?: Array<{
    taskId: string;
    taskTitle: string;
    durationMinutes: number;
    plannedMinutes: number;
    completedAt: Date | string;
  }>;
  pendingInboxItemsCount?: number;
  availableHoursTonight?: number;
}

export interface AIChatResponse {
  message: string;
  actions?: AIAction[];
  reasoning?: string;
  suggestedFollowUps?: string[];
  provider: "openai" | "xkiro" | "local_fallback" | "anthropic" | "ollama" | "gemini" | string;
  isFallback: boolean;
}

export interface AISmartRecommendation {
  recommended: {
    id: string;
    title: string;
    description?: string | null;
    projectId?: string | null;
    projectName?: string | null;
    priority: string;
    deadline?: Date | string | null;
    estimatedMinutes?: number | null;
    blocks: Array<{ id: string; title: string; status: string }>;
    blockers: Array<{ id: string; title: string; status: string }>;
    risk?: {
      riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      score: number;
      explanation: string;
    };
  } | null;
  reason: string;
  whyThisTask: string;
  riskIfDelayed: string;
  expectedTime: string;
  blockersExplanation: string;
  nextAfterThis?: string;
  provider?: string;
  isFallback?: boolean;
}

export interface AIProductivityInsight {
  title: string;
  insight: string;
  type: "WARNING" | "SUCCESS" | "RECOMMENDATION" | "NEUTRAL";
  metricSource?: string;
  actionableSuggestion?: string;
}

export interface AIDailyBriefing {
  greeting: string;
  summary: string;
  totalTasksToday: number;
  dueTodayCount: number;
  overdueCount: number;
  blockedCount: number;
  estimatedWorkHours: number;
  availableHours: number;
  topAction: {
    title: string;
    why: string;
    unlocks?: string;
  } | null;
  suggestedSchedule: Array<{
    timeSlot: string;
    taskTitle: string;
    durationMinutes: number;
  }>;
  deadlineAlerts: Array<{
    title: string;
    deadline: string;
    urgency: string;
  }>;
  provider: string;
  isFallback: boolean;
}

export interface AITaskBreakdown {
  originalTask: string;
  subtasks: Array<{
    title: string;
    description?: string;
    estimatedMinutes: number;
    priority: TaskPriority;
    dependsOnPrevious?: boolean;
  }>;
  actions: AIAction[];
  provider: string;
  isFallback: boolean;
}

export interface AIProjectReview {
  projectId: string;
  projectName: string;
  healthStatus: "HEALTHY" | "AT_RISK" | "BLOCKED" | "ON_TRACK";
  healthPercentage: number;
  executiveSummary: string;
  bottlenecks: string[];
  recommendations: string[];
  criticalPath: string[];
  estimatedRemainingMinutes: number;
  provider: string;
  isFallback: boolean;
}

export interface AIWeeklyReview {
  summary: string;
  completionVelocity: string;
  topBottleneckProject?: string;
  actionableChanges: string[];
  productivityScore: number;
  provider: string;
  isFallback: boolean;
}


