import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: true });

export const config = {
  server: {
    port: parseInt(process.env.SERVER_PORT || "3001", 10),
    nodeEnv: process.env.NODE_ENV || "development",
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET || "dev_secret_key",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "dev_refresh_secret",
    expiry: process.env.JWT_EXPIRY || "15m",
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || "7d",
  },
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  },
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "52428800", 10), // 50MB
    allowedMimeTypes: (process.env.ALLOWED_MIME_TYPES || "").split(","),
  },
  ai: {
    provider: process.env.AI_PROVIDER || "gemini",
    model: process.env.AI_MODEL || "gemini-flash-lite-latest",
    geminiKey: process.env.GEMINI_API_KEY,
    openaiKey: process.env.OPENAI_API_KEY,
    xkiroKey: process.env.XKIRO_API_KEY,
    anthropicKey: process.env.ANTHROPIC_API_KEY,
  },
};
