import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { logger } from "../config/logger";

export interface AuthRequest extends Express.Request {
  userId?: string;
  user?: any;
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "No authentication token provided",
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    req.userId = decoded.userId;
    next();
  } catch (error) {
    logger.error("Token verification failed", { error });
    if (error instanceof jwt.ExpiredSignatureError) {
      return res.status(401).json({
        success: false,
        error: "Token has expired",
        code: "TOKEN_EXPIRED",
      });
    }
    return res.status(403).json({
      success: false,
      error: "Invalid token",
    });
  }
};

export const generateAccessToken = (userId: string) => {
  return jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiry,
  });
};

export const generateRefreshToken = (userId: string) => {
  return jwt.sign({ userId }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiry,
  });
};

export const verifyRefreshToken = (token: string) => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret) as any;
  } catch (error) {
    logger.error("Refresh token verification failed", { error });
    throw new Error("Invalid refresh token");
  }
};
