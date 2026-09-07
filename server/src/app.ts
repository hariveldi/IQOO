import express, { Express, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config";
import { logger } from "./config/logger";
import { errorHandler } from "./middleware/errorHandler";

// Routes
import authRoutes from "./routes/auth";
import taskRoutes from "./routes/tasks";
import projectRoutes from "./routes/projects";
import actionInboxRoutes from "./routes/actionInbox";
import aiRoutes from "./routes/ai";
import plannerRoutes from "./routes/planner";

export const createApp = (): Express => {
  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: config.cors.origin,
      credentials: true,
    })
  );

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  });
  app.use(limiter);

  // Body parsing
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Request logging
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });

  // Health check
  app.get("/health", (req: any, res: Response) => {
    res.json({ status: "ok", timestamp: new Date() });
  });

  // API routes
  app.use("/api/auth", authRoutes);
  app.use("/api/tasks", taskRoutes);
  app.use("/api/projects", projectRoutes);
  app.use("/api/inbox", actionInboxRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/planner", plannerRoutes);

  // 404 handler
  app.use((req: any, res: Response) => {
    res.status(404).json({
      success: false,
      error: "Not found",
      path: req.path,
    });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
};
