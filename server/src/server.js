import { Sample, SensorReading, SampleImage, DegradationPrediction } from './module02/models.js';
import { createModule02Router } from './module02/routes.js';
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

const port = process.env.PORT || 5000;

export function createApp({ module02 = {} } = {}) {
const app = express();

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
app.use("/api", createModule02Router(module02));

app.use((_request, response) => {
  response.status(404).json({ message: "Route not found" });
});

app.use((error, request, response, next) => {
  if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') return response.status(error.status || 400).json({error:{code:'INVALID_REQUEST',message:'Invalid JSON or request exceeds size limit.'}});
  next(error);
});
app.use(errorHandler);

return app;
}

async function startServer() {
  const app = createApp();
  const connected = await connectDatabase();
  if (connected) await Promise.all([Sample,SensorReading,SampleImage,DegradationPrediction].map(Model=>Model.init()));
  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startServer().catch((error) => {
  console.error("Unable to start server:", error.message);
  process.exitCode = 1;
});
