import { TaskExtractionResult, DocumentExtractionResult } from "@iqoo/shared";

/**
 * Abstract AI Provider interface
 * Allows switching between different AI providers (OpenAI, Anthropic, local, Ollama, etc.)
 */
export interface AIProvider {
  extractTaskFromText(text: string): Promise<TaskExtractionResult>;
  extractFromImage(imageBase64: string): Promise<TaskExtractionResult>;
  extractFromDocument(
    documentContent: string,
    fileName: string
  ): Promise<DocumentExtractionResult>;
  generateTaskRecommendation(userContext: string): Promise<string>;
  processConversation(message: string, context?: any): Promise<string>;
  generateEmbedding(text: string): Promise<number[]>;
}

/**
 * Mock local AI provider for development
 * In production, replace with real integration
 */
export class LocalAIProvider implements AIProvider {
  async extractTaskFromText(text: string): Promise<TaskExtractionResult> {
    // Simple pattern matching for development
    const titleMatch = text.match(/(?:task|do|need to|should|must)[\s:]*(.+?)(?:\.|$)/i);
    const deadlineMatch = text.match(/(?:by|due|deadline|until)[\s:]*(.+?)(?:\.|$)/i);
    const priorityMatch = text.match(/(?:urgent|critical|high priority|asap)/i);

    return {
      title: titleMatch ? titleMatch[1].trim() : "Unspecified task",
      description: text,
      deadline: deadlineMatch
        ? new Date(deadlineMatch[1])
        : undefined,
      priority: priorityMatch ? "HIGH" : "MEDIUM",
      estimatedMinutes: Math.random() * 120 + 15,
      confidence: 0.7,
    };
  }

  async extractFromImage(imageBase64: string): Promise<TaskExtractionResult> {
    // Placeholder for image processing
    // In production, integrate with Vision API or local OCR
    return {
      title: "Task from image",
      description: "Image content would be extracted here",
      confidence: 0.5,
    };
  }

  async extractFromDocument(
    documentContent: string,
    fileName: string
  ): Promise<DocumentExtractionResult> {
    // Placeholder for document processing
    const lines = documentContent.split("\n").filter((l) => l.trim());

    return {
      summary: lines.slice(0, 3).join(" "),
      keyPoints: lines.slice(0, 5),
      actionItems: lines
        .filter((l) => l.includes("-") || l.includes("•"))
        .slice(0, 5),
    };
  }

  async generateTaskRecommendation(userContext: string): Promise<string> {
    return "Based on your tasks, focus on high-priority items with upcoming deadlines.";
  }

  async processConversation(message: string, context?: any): Promise<string> {
    // Simple response for development
    if (message.toLowerCase().includes("what should i")) {
      return "You should focus on the most urgent task with an upcoming deadline.";
    }
    return "I've noted that. Let me help you manage this.";
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Placeholder for embedding generation
    // In production, use real embedding model
    return Array(384).fill(0).map(() => Math.random());
  }
}

/**
 * Factory for creating AI provider instances
 */
export class AIProviderFactory {
  static create(provider: string): AIProvider {
    switch (provider.toLowerCase()) {
      case "openai":
        // return new OpenAIProvider();
        throw new Error("OpenAI provider not yet implemented");
      case "anthropic":
        // return new AnthropicProvider();
        throw new Error("Anthropic provider not yet implemented");
      case "ollama":
        // return new OllamaProvider();
        throw new Error("Ollama provider not yet implemented");
      case "local":
      default:
        return new LocalAIProvider();
    }
  }
}
