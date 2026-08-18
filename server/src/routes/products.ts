import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { productsRepo } from "../repositories/products.js";

export const productsRouter = Router();
productsRouter.use(requireAuth);

// See clients.ts for why numeric columns are converted to strings here.
const money = () => z.number().transform(String);
const optionalMoney = () => z.number().nullable().optional().transform((v) => (v === undefined || v === null ? v : String(v)));

const productInputSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  unit: z.string().optional(),
  unitPrice: money(),
  tvaRate: optionalMoney(),
  timbreExempt: z.boolean().nullable().optional(),
  displayOrder: z.number().int().optional(),
});

productsRouter.get("/", asyncHandler(async (req, res) => {
  const rows = await productsRepo.findAll(req.auth!.orgId);
  res.json(rows);
}));

productsRouter.post("/", asyncHandler(async (req, res) => {
  const parsed = productInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", issues: parsed.error.flatten() });
    return;
  }
  const created = await productsRepo.create(req.auth!.orgId, parsed.data);
  res.status(201).json(created);
}));

productsRouter.put("/:id", asyncHandler(async (req, res) => {
  const parsed = productInputSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", issues: parsed.error.flatten() });
    return;
  }
  const updated = await productsRepo.update(req.auth!.orgId, req.params.id, parsed.data);
  if (!updated) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(updated);
}));

productsRouter.delete("/:id", asyncHandler(async (req, res) => {
  await productsRepo.remove(req.auth!.orgId, req.params.id);
  res.status(204).end();
}));
