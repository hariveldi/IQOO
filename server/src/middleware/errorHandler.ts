import { Response, NextFunction } from "express";
import { logger } from "../config/logger";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errorHandler = (
  err: any,
  req: Express.Request,
  res: Response,
  next: NextFunction
) => {
  logger.error("Error occurred", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      timestamp: new Date(),
    });
  }

  // Validation errors
  if (err.name === "ZodError") {
    return res.status(400).json({
      success: false,
      error: "Validation error",
      details: err.errors,
      timestamp: new Date(),
    });
  }

  // Prisma errors
  if (err.code === "P2002") {
    return res.status(409).json({
      success: false,
      error: "Resource already exists",
      code: "DUPLICATE_ENTRY",
      timestamp: new Date(),
    });
  }

  if (err.code === "P2025") {
    return res.status(404).json({
      success: false,
      error: "Resource not found",
      code: "NOT_FOUND",
      timestamp: new Date(),
    });
  }

  // Default error
  res.status(500).json({
    success: false,
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
    timestamp: new Date(),
  });
};
