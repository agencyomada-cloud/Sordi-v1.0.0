import { Router } from "express";
import { clientInputSchema } from "@sordi/schema";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { clientsRepo } from "../repositories/clients.js";

export const clientsRouter = Router();
clientsRouter.use(requireAuth);

clientsRouter.get("/", asyncHandler(async (req, res) => {
  const rows = await clientsRepo.findAll(req.auth!.orgId);
  res.json(rows);
}));

clientsRouter.get("/:id", asyncHandler(async (req, res) => {
  const row = await clientsRepo.findById(req.auth!.orgId, req.params.id);
  if (!row) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(row);
}));

clientsRouter.post("/", asyncHandler(async (req, res) => {
  const parsed = clientInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", issues: parsed.error.flatten() });
    return;
  }
  const created = await clientsRepo.create(req.auth!.orgId, parsed.data);
  res.status(201).json(created);
}));

clientsRouter.put("/:id", asyncHandler(async (req, res) => {
  const parsed = clientInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", issues: parsed.error.flatten() });
    return;
  }
  const updated = await clientsRepo.update(req.auth!.orgId, req.params.id, parsed.data);
  if (!updated) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(updated);
}));

clientsRouter.delete("/:id", asyncHandler(async (req, res) => {
  await clientsRepo.remove(req.auth!.orgId, req.params.id);
  res.status(204).end();
}));
