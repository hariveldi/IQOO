import { describe, it, expect } from "vitest";
import { GeminiProvider, AIProviderError, AIProviderFactory } from "../ai/provider";

describe("Real Google Gemini Flash Provider", () => {
  it("should initialize with gemini-flash-lite-latest model and identify as real AI", () => {
    const provider = new GeminiProvider("dummy_key", "gemini-flash-lite-latest");
    expect(provider.getProviderName()).toBe("gemini");
    expect(provider.isRealAI()).toBe(true);
  });

  it("should fail with clear 401 error if GEMINI_API_KEY is missing or empty", async () => {
    const provider = new GeminiProvider("", "gemini-flash-lite-latest");
    await expect(
      provider.understandAndStructureAction({ text: "Create a task" })
    ).rejects.toThrow(/GEMINI_API_KEY is not configured/);
  });

  it("should make a real network call to Google Generative Language API and report exact error for invalid key", async () => {
    const provider = new GeminiProvider("INVALID_GEMINI_KEY_FOR_TESTING", "gemini-flash-lite-latest");
    
    // Minimal 1x1 transparent PNG as base64
    const sampleImage = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    try {
      await provider.understandAndStructureAction({
        text: "Extract info from this screenshot and create a task",
        image: sampleImage,
        mimeType: "image/png",
      });
      // Should not succeed with invalid key
      expect.fail("Expected Gemini call to throw with invalid API key");
    } catch (err: any) {
      expect(err).toBeInstanceOf(AIProviderError);
      // Google API returns HTTP 400 with "API key not valid" message
      expect(err.statusCode).toBe(400);
      expect(err.message).toMatch(/API key not valid|Gemini API error/i);
    }
  });

  it("AIProviderFactory should strictly return GeminiProvider when gemini is requested", () => {
    const provider = AIProviderFactory.create("gemini", "some_key", "gemini-flash-lite-latest");
    expect(provider.getProviderName()).toBe("gemini");
    expect(provider.isRealAI()).toBe(true);
  });
});
