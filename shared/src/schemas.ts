import { z } from "zod";
import { TaskStatus, TaskPriority, ActionInboxItemType, CaptureSource } from "./types";

// Auth Schemas
export const RegisterSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Task Schemas
export const CreateTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  deadline: z.coerce.date().optional(),
  estimatedMinutes: z.number().min(1).optional(),
  projectId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
});

export const UpdateTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(255).optional(),
  description: z.string().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  deadline: z.coerce.date().optional(),
  estimatedMinutes: z.number().min(1).optional(),
  actualMinutes: z.number().min(0).optional(),
  tags: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
});

// Project Schemas
export const CreateProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(255).optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
});

// AI Extraction Schemas
export const TaskExtractionSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  deadline: z.coerce.date().optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  estimatedMinutes: z.number().optional(),
  project: z.string().optional(),
  people: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const DocumentExtractionSchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
  actionItems: z.array(z.string()),
  deadlines: z.array(z.coerce.date()).optional(),
  people: z.array(z.string()).optional(),
  decisions: z.array(z.string()).optional(),
  tasks: z.array(TaskExtractionSchema).optional(),
});

// Action Inbox Schemas
export const ActionInboxItemSchema = z.object({
  type: z.nativeEnum(ActionInboxItemType),
  source: z.nativeEnum(CaptureSource),
  rawContent: z.string(),
  extractedData: z.record(z.any()).optional(),
});

export const CreateActionInboxSchema = z.object({
  type: z.nativeEnum(ActionInboxItemType),
  source: z.nativeEnum(CaptureSource),
  rawContent: z.string(),
  extractedData: z.record(z.any()).optional(),
});

// AI Assistant Schemas
export const AIAssistantRequestSchema = z.object({
  message: z.string().min(1, "Message cannot be empty"),
  context: z
    .object({
      currentTaskId: z.string().optional(),
      projectId: z.string().optional(),
    })
    .optional(),
});

export const VoiceCaptureSchema = z.object({
  audioData: z.string(), // base64 encoded
  duration: z.number().min(0),
});

export const ImageCaptureSchema = z.object({
  imageData: z.string(), // base64 encoded
  type: z.enum(["WHITEBOARD", "NOTES", "DOCUMENT", "SCREEN", "MEETING", "OTHER"]),
});

export const DocumentUploadSchema = z.object({
  fileName: z.string(),
  fileSize: z.number().max(52428800), // 50MB
  mimeType: z.enum([
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]),
  base64Content: z.string(),
});

// Response Schemas
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  timestamp: z.date(),
});

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  timestamp: z.date(),
});

// Type exports from schemas
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type TaskExtractionInput = z.infer<typeof TaskExtractionSchema>;
export type DocumentExtractionInput = z.infer<typeof DocumentExtractionSchema>;
export type AIAssistantRequest = z.infer<typeof AIAssistantRequestSchema>;
export type VoiceCaptureInput = z.infer<typeof VoiceCaptureSchema>;
export type ImageCaptureInput = z.infer<typeof ImageCaptureSchema>;
export type DocumentUploadInput = z.infer<typeof DocumentUploadSchema>;
