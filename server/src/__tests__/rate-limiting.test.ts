import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../app";
import { Server } from "http";

describe("Rate Limiting and Authentication E2E", () => {
  const app = createApp();
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address: any = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("should successfully log in with demo credentials demo@example.com and password", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "demo@example.com", password: "password" }),
    });

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.user.email).toBe("demo@example.com");
    expect(json.data.accessToken).toBeDefined();
    expect(json.data.refreshToken).toBeDefined();
  });

  it("should connect Office Kit laptop successfully with valid auth token", async () => {
    // 1. Log in
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "demo@example.com", password: "password" }),
    });
    const loginJson = await loginRes.json();
    const token = loginJson.data.accessToken;

    // 2. Connect laptop
    const connectRes = await fetch(`${baseUrl}/api/ai/office-kit/connect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ deviceName: "ThinkPad Demo Laptop" }),
    });

    const connectJson = await connectRes.json();
    expect(connectRes.status).toBe(200);
    expect(connectJson.success).toBe(true);
    expect(connectJson.data.connected).toBe(true);
    expect(connectJson.data.laptop.name).toBe("ThinkPad Demo Laptop");
  });

  it("should allow high frequency background polling without hitting 429 rate limit", async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "demo@example.com", password: "password" }),
    });
    const loginJson = await loginRes.json();
    const token = loginJson.data.accessToken;

    // Simulate 60 status checks and heartbeats
    for (let i = 0; i < 60; i++) {
      const statusRes = await fetch(`${baseUrl}/api/ai/office-kit/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(statusRes.status).not.toBe(429);
      expect(statusRes.status).toBe(200);
    }

    // Normal API request right after polling should succeed
    const tasksRes = await fetch(`${baseUrl}/api/tasks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(tasksRes.status).not.toBe(429);
    expect(tasksRes.status).toBe(200);
  });
});
