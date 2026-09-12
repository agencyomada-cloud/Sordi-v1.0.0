import { desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { leads } from "@sordi/schema";

export type NewLeadInput = typeof leads.$inferInsert;

export const leadsRepo = {
  create: (data: Omit<NewLeadInput, "id" | "createdAt">) =>
    db.insert(leads).values(data).returning().then((rows) => rows[0]),

  // Newest first — used by the admin portal's Prospects tab and the
  // notification-bell's "recent leads" poll.
  listRecent: (limit = 50) => db.select().from(leads).orderBy(desc(leads.createdAt)).limit(limit),
};
