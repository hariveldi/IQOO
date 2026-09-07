import { createApp } from "./app";
import { config } from "./config";
import { logger } from "./config/logger";

const app = createApp();

const server = app.listen(config.server.port, () => {
  logger.info(`🚀 Server running on http://localhost:${config.server.port}`);
  logger.info(`Environment: ${config.server.nodeEnv}`);
  logger.info(`AI Provider: ${config.ai.provider}`);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
});

export default server;
