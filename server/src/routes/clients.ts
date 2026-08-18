import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { clientsRepo } from "../repositories/clients.js";

export const clientsRouter = Router();
clientsRouter.use(requireAuth);

// Drizzle's `numeric` columns are typed as `string` (money stays exact,
// never a JS float) — the schema accepts a plain JS number from callers and
// converts it to that string right here, so no separate mapping step is
// needed before handing the parsed result to the repository.
const money = () => z.number().optional().transform((v) => (v === undefined ? undefined : String(v)));

const clientInputSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  wilaya: z.string().optional(),
  nif: z.string().optional(),
  nis: z.string().optional(),
  rc: z.string().optional(),
  secondaryRc: z.string().optional(),
  secondaryAddress: z.string().optional(),
  ai: z.string().optional(),
  activite: z.string().optional(),
  creditLimit: money(),
  paymentTermsDays: z.number().int().optional(),
  notes: z.string().optional(),
  initialBalance: money(),
  advancePayment: money(),
});

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
