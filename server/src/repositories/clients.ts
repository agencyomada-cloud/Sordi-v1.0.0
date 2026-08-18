import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { clients } from "../db/schema.js";

export type NewClientInput = Omit<
  typeof clients.$inferInsert,
  "id" | "orgId" | "createdAt" | "updatedAt"
>;

// Every function here takes orgId as a required, non-optional argument and
// uses it in the WHERE clause — this file is the only place clients are
// queried from, so "forgot to scope by tenant" cannot happen in a route.

export const clientsRepo = {
  findAll: (orgId: string) =>
    db.select().from(clients).where(eq(clients.orgId, orgId)).orderBy(clients.name),

  findById: (orgId: string, id: string) =>
    db
      .select()
      .from(clients)
      .where(and(eq(clients.orgId, orgId), eq(clients.id, id)))
      .then((rows) => rows[0] ?? null),

  create: (orgId: string, data: NewClientInput) =>
    db
      .insert(clients)
      .values({ ...data, orgId })
      .returning()
      .then((rows) => rows[0]),

  update: (orgId: string, id: string, data: Partial<NewClientInput>) =>
    db
      .update(clients)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(clients.orgId, orgId), eq(clients.id, id)))
      .returning()
      .then((rows) => rows[0] ?? null),

  remove: (orgId: string, id: string) =>
    db.delete(clients).where(and(eq(clients.orgId, orgId), eq(clients.id, id))),
};
