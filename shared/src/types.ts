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
