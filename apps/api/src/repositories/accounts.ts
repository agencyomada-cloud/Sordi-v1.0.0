import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { memberships, organizations, users } from "@sordi/schema";

export const accountsRepo = {
  findUserByEmail: (email: string) =>
    db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .then((rows) => rows[0] ?? null),

  /** First membership for a user — this slice gives each signup exactly one organization. */
  findMembershipForUser: (userId: string) =>
    db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, userId))
      .then((rows) => rows[0] ?? null),

  /** Creates a user, a new organization named after them, and an `owner` membership, atomically. */
  signup: (email: string, passwordHash: string, orgName: string) =>
    db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ email: email.toLowerCase(), passwordHash })
        .returning();
      const [org] = await tx.insert(organizations).values({ name: orgName }).returning();
      const [membership] = await tx
        .insert(memberships)
        .values({ userId: user.id, orgId: org.id, role: "owner" })
        .returning();
      return { user, org, membership };
    }),
};
