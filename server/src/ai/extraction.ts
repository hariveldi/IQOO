import { TaskExtractionResult, DocumentExtractionResult, TaskPriority } from "@iqoo/shared";
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
    if (!result.confidence) {
      result.confidence = 0.75;
    }
    return result;
  }

  /**
   * Extract structured data from image/camera
   */
  async extractFromImage(
    imageBase64: string,
    imageType?: string
  ): Promise<TaskExtractionResult> {
    const result = await this.aiProvider.extractFromImage(imageBase64, imageType);
    if (imageType === "WHITEBOARD" || imageType === "MEETING") {
      result.priority = result.priority || TaskPriority.HIGH;
      result.confidence = (result.confidence || 0) + 0.1;
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

    if (!result.keyPoints || result.keyPoints.length === 0) {
      result.keyPoints = result.summary ? [result.summary] : [];
    }

    if (!result.actionItems || result.actionItems.length === 0) {
      result.actionItems = ["Review document", "Follow up on key points"];
    }

    return result;
  }
}

