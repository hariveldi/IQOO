import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalAIProvider } from "../ai/provider";
import { AIService } from "../services";
import { prisma } from "../repositories/prisma";

describe("Phone-First AI Action Pipeline", () => {
  const localProvider = new LocalAIProvider();
  const aiService = new AIService(localProvider);
  const testUserId = "test-user-pipeline-123";

  beforeEach(async () => {
    // Ensure test user exists
    await prisma.user.upsert({
      where: { id: testUserId },
      update: {},
      create: {
        id: testUserId,
        email: `test_pipeline_${Date.now()}@iqoo.local`,
        name: "Test User",
        password: "hashed_password",
      },
    });
  });

  afterEach(async () => {
    // Cleanup generated test data
    await prisma.taskDependency.deleteMany({ where: { fromTask: { userId: testUserId } } });
    await prisma.task.deleteMany({ where: { userId: testUserId } });
    await prisma.note.deleteMany({ where: { userId: testUserId } });
    await prisma.document.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  it("should extract structured task action from natural voice/text command and execute it", async () => {
    const input = {
      text: "Create a task called Fix authentication bug with high priority tomorrow",
      autoExecute: true,
    };

    const result = await aiService.processActionPipeline(testUserId, input);

    expect(result.action.type.toLowerCase()).toBe("create_task");
    expect(result.executed).toBe(true);
    expect(result.executionResult).toBeDefined();
    const exec: any = result.executionResult;
    expect(exec.title).toContain("Fix authentication bug");
    expect(exec.priority).toBe("HIGH");
    expect(exec.deadline).toBeDefined();

    // Verify task actually exists in the database
    const createdTask = await prisma.task.findFirst({
      where: { id: exec.id, userId: testUserId },
    });
    expect(createdTask).not.toBeNull();
    expect(createdTask?.title).toContain("Fix authentication bug");
  });

  it("should extract invoice information and create structured task", async () => {
    const input = {
      text: "Look at this invoice from Acme Corp for ₹5,000 due on Friday and create a task",
      image: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...",
      autoExecute: true,
    };

    const result = await aiService.processActionPipeline(testUserId, input);

    expect(result.action.type.toLowerCase()).toBe("create_task");
    expect(result.extractedInfo.fields).toBeDefined();
    expect(result.extractedInfo.fields?.Amount).toBe("₹5,000");
    expect(result.executed).toBe(true);
    const exec: any = result.executionResult;
    expect(exec.id).toBeDefined();
  });

  it("should extract tabular data and generate a real CSV Document asset", async () => {
    const input = {
      text: "Extract this invoice line items and create a CSV",
      image: "data:image/jpeg;base64,dummybase64data",
      autoExecute: true,
    };

    const result = await aiService.processActionPipeline(testUserId, input);

    expect(result.action.type.toLowerCase()).toBe("create_csv");
    expect(result.executed).toBe(true);
    const exec: any = result.executionResult;
    expect(exec.file).toBeDefined();
    expect(exec.file.type).toBe("text/csv");
    expect(exec.file.content).toContain("Item,Quantity,Unit Price");

    // Verify document was stored in database
    const doc = await prisma.document.findFirst({
      where: { userId: testUserId, fileType: "text/csv" },
    });
    expect(doc).not.toBeNull();
    expect(doc?.content).toContain("Item,Quantity,Unit Price");
  });

  it("should generate a structured Markdown report and persist to Note and Document", async () => {
    const input = {
      text: "Analyze this document and create a formal executive report",
      autoExecute: true,
    };

    const result = await aiService.processActionPipeline(testUserId, input);

    expect(result.action.type.toLowerCase()).toBe("create_report");
    expect(result.executed).toBe(true);
    const exec: any = result.executionResult;
    expect(exec.file.type).toBe("text/markdown");
    expect(exec.file.content).toContain("Executive Summary");

    // Verify Note and Document were both saved in DB
    const note = await prisma.note.findFirst({ where: { userId: testUserId } });
    const doc = await prisma.document.findFirst({ where: { userId: testUserId, fileType: "text/markdown" } });

    expect(note).not.toBeNull();
    expect(doc).not.toBeNull();
  });

  it("should handle save_note action and store in Note model", async () => {
    const input = {
      text: "Save this meeting note: Client requested SSO integration by next quarter",
      autoExecute: true,
    };

    const result = await aiService.processActionPipeline(testUserId, input);

    expect(result.action.type.toLowerCase()).toBe("save_note");
    expect(result.executed).toBe(true);
    const exec: any = result.executionResult;
    expect(exec.id).toBeDefined();

    const note = await prisma.note.findFirst({
      where: { id: exec.id, userId: testUserId },
    });
    expect(note).not.toBeNull();
    expect(note?.content).toContain("SSO integration");
  });

  it("should handle Office Kit send_to_laptop workflow", async () => {
    const input = {
      text: "Extract this project roadmap and send to laptop via Office Kit",
      autoExecute: true,
    };

    const result = await aiService.processActionPipeline(testUserId, input);

    expect(result.action.type.toLowerCase()).toBe("send_to_laptop");
    expect(result.executed).toBe(true);
    const exec: any = result.executionResult;
    expect(exec.officeKitSync).toBeDefined();
    expect(exec.officeKitSync.destination).toBe("Laptop (Office Kit)");

    const doc = await prisma.document.findFirst({
      where: { userId: testUserId, filePath: { startsWith: "officekit/" } },
    });
    expect(doc).not.toBeNull();
  });

  it("should respect autoExecute: false and return structured action without database execution", async () => {
    const input = {
      text: "Create a task called Pending Review Task with low priority",
      autoExecute: false,
    };

    const result = await aiService.processActionPipeline(testUserId, input);

    expect(result.action.type.toLowerCase()).toBe("create_task");
    expect(result.executed).toBe(false);
    expect(result.executionResult).toBeUndefined();

    // Verify nothing created in DB
    const task = await prisma.task.findFirst({
      where: { title: "Pending Review Task", userId: testUserId },
    });
    expect(task).toBeNull();
  });

  describe("Office Kit Laptop Connection & Ambient Task Transfer", () => {
    it("should report laptop as not connected initially and reject transfer", async () => {
      const { AIController, activeLaptopSessions } = await import("../controllers/aiController");
      activeLaptopSessions.delete(testUserId);
      const controller = new AIController(aiService);

      let statusResult: any;
      await controller.getOfficeKitStatus(
        { userId: testUserId } as any,
        { json: (data: any) => { statusResult = data; } } as any
      );

      expect(statusResult.success).toBe(true);
      expect(statusResult.data.connected).toBe(false);
      expect(statusResult.data.laptop).toBeNull();

      // Attempting transfer when disconnected must reject with error
      await expect(
        controller.transferTaskToLaptop(
          { userId: testUserId, body: { title: "Test Task" } } as any,
          { json: () => {} } as any
        )
      ).rejects.toThrow(/Laptop not connected/i);
    });

    it("should connect laptop, preserve task in SQLite, and transfer task via Office Kit document staging", async () => {
      const { AIController } = await import("../controllers/aiController");
      const controller = new AIController(aiService);

      // 1. First, create a task in SQLite (Ambient AI creates it in SQLite)
      const task = await prisma.task.create({
        data: {
          userId: testUserId,
          title: "Submit project report",
          description: "Final quarterly submission",
          priority: "HIGH",
          status: "TODO",
        },
      });

      // 2. Connect laptop companion
      let connectResult: any;
      await controller.connectLaptop(
        { userId: testUserId, body: { deviceName: "ThinkPad X1 Carbon" }, ip: "192.168.1.100" } as any,
        { json: (data: any) => { connectResult = data; } } as any
      );
      expect(connectResult.success).toBe(true);
      expect(connectResult.data.connected).toBe(true);
      expect(connectResult.data.laptop.name).toBe("ThinkPad X1 Carbon");

      // 3. Status should now be connected
      let statusResult: any;
      await controller.getOfficeKitStatus(
        { userId: testUserId } as any,
        { json: (data: any) => { statusResult = data; } } as any
      );
      expect(statusResult.data.connected).toBe(true);
      expect(statusResult.data.laptop.name).toBe("ThinkPad X1 Carbon");

      // 4. Transfer the task to the laptop
      let transferResult: any;
      await controller.transferTaskToLaptop(
        {
          userId: testUserId,
          body: {
            taskId: task.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
          },
        } as any,
        { json: (data: any) => { transferResult = data; } } as any
      );

      expect(transferResult.success).toBe(true);
      expect(transferResult.data.transferred).toBe(true);
      expect(transferResult.data.laptopName).toBe("ThinkPad X1 Carbon");

      // 5. CRITICAL CONSTRAINT: Task MUST still exist in SQLite!
      const preservedTask = await prisma.task.findUnique({
        where: { id: task.id },
      });
      expect(preservedTask).not.toBeNull();
      expect(preservedTask?.title).toBe("Submit project report");

      // 6. Office Kit document record must be staged for laptop pickup
      const stagedDoc = await prisma.document.findFirst({
        where: {
          userId: testUserId,
          filePath: { startsWith: "officekit/" },
        },
        orderBy: { createdAt: "desc" },
      });
      expect(stagedDoc).not.toBeNull();
      expect(stagedDoc?.content).toContain("Submit project report");
      expect(stagedDoc?.content).toContain("ThinkPad X1 Carbon");

      // 7. Disconnecting laptop
      let disconnectResult: any;
      await controller.disconnectLaptop(
        { userId: testUserId } as any,
        { json: (data: any) => { disconnectResult = data; } } as any
      );
      expect(disconnectResult.data.connected).toBe(false);
    });
  });

  describe("AI Commitment-to-Action Engine", () => {
    it("should extract message commitment with structured draft payload for sending a report", async () => {
      const input = {
        text: "I'll send Rahul the project report tomorrow.",
        autoExecute: true,
      };

      const result = await aiService.processActionPipeline(testUserId, input);

      expect(result.commitment).toBeDefined();
      const commitment = result.commitment!;
      expect(commitment.owner).toBe("me");
      expect(commitment.person).toBe("Rahul");
      expect(commitment.deadline?.toLowerCase()).toContain("tomorrow");
      expect(commitment.executionType).toBe("message");
      expect(commitment.draftExecution).toBeDefined();
      expect(commitment.draftExecution?.recipient).toBe("Rahul");
      expect(commitment.draftExecution?.draftText).toBeDefined();
      expect(commitment.confidence).toBeGreaterThan(0.7);

      // Verify task is also created in SQLite database
      expect(result.executed).toBe(true);
      const exec: any = result.executionResult;
      expect(exec.id).toBeDefined();
      const task = await prisma.task.findUnique({ where: { id: exec.id } });
      expect(task).not.toBeNull();
      expect(task?.title).toContain("Rahul");
    });

    it("should extract calendar commitment with structured draft event for meetings", async () => {
      const input = {
        text: "I will meet Priya tomorrow at 3 PM for design review",
        autoExecute: true,
      };

      const result = await aiService.processActionPipeline(testUserId, input);

      expect(result.commitment).toBeDefined();
      const commitment = result.commitment!;
      expect(commitment.owner).toBe("me");
      expect(commitment.person).toBe("Priya");
      expect(commitment.executionType).toBe("calendar");
      expect(commitment.draftExecution).toBeDefined();
      expect(commitment.draftExecution?.title).toBeDefined();
      expect(commitment.confidence).toBeGreaterThan(0.7);
    });

    it("should extract laptop commitment when targeting laptop workflow", async () => {
      const input = {
        text: "I will prepare the presentation on my laptop tonight",
        autoExecute: true,
      };

      const result = await aiService.processActionPipeline(testUserId, input);

      expect(result.commitment).toBeDefined();
      const commitment = result.commitment!;
      expect(commitment.owner).toBe("me");
      expect(commitment.executionType).toBe("laptop");
      expect(commitment.draftExecution).toBeDefined();
      expect(commitment.draftExecution?.laptopPayload).toBeDefined();
    });
  });
});

