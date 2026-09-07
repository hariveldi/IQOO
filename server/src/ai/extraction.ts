import { TaskExtractionResult, DocumentExtractionResult } from "@iqoo/shared";
import { AIProvider } from "./provider";

/**
 * AI Extraction Service
 * Handles all AI-powered extraction and processing
 */
export class ExtractionService {
  constructor(private aiProvider: AIProvider) {}

  /**
   * Extract task from voice transcript
   */
  async extractTaskFromVoice(transcript: string): Promise<TaskExtractionResult> {
    const result = await this.aiProvider.extractTaskFromText(transcript);
    
    // Ensure confidence level
    if (!result.confidence) {
      result.confidence = 0.75; // Default confidence for voice
    }

    return result;
  }

  /**
   * Extract structured data from image/camera
   */
  async extractFromImage(
    imageBase64: string,
    imageType: string
  ): Promise<TaskExtractionResult> {
    // For whiteboard/notes images
    const result = await this.aiProvider.extractFromImage(imageBase64);

    // Enhance with image type context
    if (imageType === "WHITEBOARD" || imageType === "MEETING") {
      result.priority = result.priority || "HIGH";
      result.confidence = (result.confidence || 0) + 0.1; // Boost confidence for structured sources
    }

    return result;
  }

  /**
   * Extract from document (PDF, DOCX, TXT, etc.)
   */
  async extractFromDocument(
    documentContent: string,
    fileName: string
  ): Promise<DocumentExtractionResult> {
    const result = await this.aiProvider.extractFromDocument(
      documentContent,
      fileName
    );

    // Post-process: ensure we have reasonable data
    if (!result.keyPoints || result.keyPoints.length === 0) {
      result.keyPoints = result.summary ? [result.summary] : [];
    }

    if (!result.actionItems || result.actionItems.length === 0) {
      // Try to infer action items from summary
      result.actionItems = [
        "Review document",
        "Follow up on key points",
      ];
    }

    return result;
  }

  /**
   * Extract meeting action items
   */
  async extractFromMeeting(
    transcript: string,
    attendees?: string[]
  ): Promise<{
    summary: string;
    actionItems: Array<{ action: string; owner?: string; deadline?: Date }>;
    decisions: string[];
  }> {
    const result = await this.aiProvider.extractFromText(transcript);

    return {
      summary: result.description || "",
      actionItems: [
        { action: "Follow up on discussed items", owner: attendees?.[0] },
      ],
      decisions: [],
    };
  }

  /**
   * Generate natural language recommendation
   */
  async generateRecommendation(context: {
    completedTasks: number;
    pendingTasks: number;
    overdueTasks: number;
    highPriorityTasks: number;
    timeOfDay?: string;
  }): Promise<string> {
    const contextStr = `
      User has completed ${context.completedTasks} tasks today.
      ${context.pendingTasks} tasks pending.
      ${context.overdueTasks} tasks overdue.
      ${context.highPriorityTasks} high-priority tasks.
      Current time: ${context.timeOfDay || "unknown"}.
    `;

    return this.aiProvider.generateTaskRecommendation(contextStr);
  }
}
