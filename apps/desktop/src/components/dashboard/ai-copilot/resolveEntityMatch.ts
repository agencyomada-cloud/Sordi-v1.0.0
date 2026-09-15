import type { CopilotContextEntity } from "./types";

/** Case-insensitive substring match, either direction (the entity's own
 *  name inside the given name, or the given name inside the entity's own
 *  name) — good enough for "ENPEC" matching "SARL ENPEC Distribution".
 *  Mirrors apps/api's copilotHeuristic.ts's own findEntityMatch, since the
 *  new batch-extraction schema carries no entity id on the wire at all —
 *  every consumer (the review card's "existing vs new" hint, and the
 *  actual confirm-time resolution) matches by name independently, so they
 *  need to agree on exactly this logic. */
export function resolveEntityMatch<T extends CopilotContextEntity>(name: string, entities: T[]): T | null {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return null;
  return entities.find((e) => e.name.length >= 2 && (trimmed.includes(e.name.toLowerCase()) || e.name.toLowerCase().includes(trimmed))) ?? null;
}
