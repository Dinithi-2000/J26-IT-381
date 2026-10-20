import { createImageRouter } from './module02-image/routes.js';
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import helmet from "helmet";
import morgan from "morgan";
import { connectDatabase, isDatabaseConnected } from "./config/db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import predictionRoutes from "./routes/predictionRoutes.js";
import { getModelInfo } from "./services/mlService.js";

const serverDirectory = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(serverDirectory, "../.env") });

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(helmet());
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    message: "API is running",
    database: isDatabaseConnected() ? "connected" : "unavailable"
  });
});

app.get("/api/model-info", async (_request, response, next) => {
  try {
    response.json(await getModelInfo());
  } catch (error) {
    next(error);
  }
});

app.use("/api/predictions", predictionRoutes);
app.use("/api/module-02/image-classification", createImageRouter());

app.use((_request, response) => {
  response.status(404).json({ message: "Route not found" });
});

app.use(errorHandler);

async function startServer() {
  await connectDatabase();
  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Unable to start server:", error.message);
  process.exitCode = 1;
});
