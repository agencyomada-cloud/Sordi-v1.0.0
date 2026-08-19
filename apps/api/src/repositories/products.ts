import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { products } from "@sordi/schema";

export type NewProductInput = Omit<
  typeof products.$inferInsert,
  "id" | "orgId" | "createdAt" | "updatedAt"
>;

export const productsRepo = {
  findAll: (orgId: string) =>
    db.select().from(products).where(eq(products.orgId, orgId)).orderBy(products.displayOrder, products.name),

  findById: (orgId: string, id: string) =>
    db
      .select()
      .from(products)
      .where(and(eq(products.orgId, orgId), eq(products.id, id)))
      .then((rows) => rows[0] ?? null),

  create: (orgId: string, data: NewProductInput) =>
    db
      .insert(products)
      .values({ ...data, orgId })
      .returning()
      .then((rows) => rows[0]),

  update: (orgId: string, id: string, data: Partial<NewProductInput>) =>
    db
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(products.orgId, orgId), eq(products.id, id)))
      .returning()
      .then((rows) => rows[0] ?? null),

  remove: (orgId: string, id: string) =>
    db.delete(products).where(and(eq(products.orgId, orgId), eq(products.id, id))),
};
