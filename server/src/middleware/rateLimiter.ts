import rateLimit from "express-rate-limit";

/**
 * General API Rate Limiter
 * Applied globally to all routes, with automatic exemption for background polling / health checks.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Generous limit for normal SPA interaction & multiple tabs
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Exempt lightweight background polling & companion heartbeats from counting against the global budget
    const path = req.originalUrl || req.url || req.path || "";
    return (
      path === "/health" ||
      path.includes("/office-kit/status") ||
      path.includes("/office-kit/heartbeat") ||
      path.includes("/office-kit/files")
    );
  },
  message: {
    success: false,
    error: "Too many requests. Please slow down and try again in a few minutes.",
    code: "RATE_LIMIT_EXCEEDED",
  },
});

/**
 * Strict Authentication Rate Limiter
 * Applied specifically to sensitive auth endpoints (/api/auth/login and /api/auth/register).
 * Protects against brute-force password guessing while giving legitimate users plenty of attempts.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 attempts per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many login attempts. Please wait a moment and try again.",
    code: "AUTH_RATE_LIMIT_EXCEEDED",
  },
});
