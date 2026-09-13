import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./env.js";
import { authRouter } from "./routes/auth.js";
import { clientsRouter } from "./routes/clients.js";
import { productsRouter } from "./routes/products.js";
import { licensesRouter } from "./routes/licenses.js";
import { telemetryRouter } from "./routes/telemetry.js";
import { adminLicensesRouter } from "./routes/adminLicenses.js";
import { adminDevicesRouter } from "./routes/adminDevices.js";
import { leadsRouter } from "./routes/leads.js";
import { adminLeadsRouter } from "./routes/adminLeads.js";
import { releasesRouter } from "./routes/releases.js";
import { copilotRouter } from "./routes/copilot.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/auth", authRouter);
  app.use("/clients", clientsRouter);
  app.use("/products", productsRouter);
  app.use("/licenses", licensesRouter);
  app.use("/telemetry", telemetryRouter);
  app.use("/admin/licenses", adminLicensesRouter);
  app.use("/admin/devices", adminDevicesRouter);
  app.use("/leads", leadsRouter);
  app.use("/admin/leads", adminLeadsRouter);
  app.use("/releases", releasesRouter);
  app.use("/copilot", copilotRouter);

  app.use(errorHandler);

  return app;
}
