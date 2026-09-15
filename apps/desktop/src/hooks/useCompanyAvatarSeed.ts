import { useCallback, useEffect, useState } from "react";

const storageKey = (companyId: string) => `sordi.avatar.seed.${companyId}`;

function readSeed(companyId: string | undefined): string {
  if (!companyId) return "sordi";
  try {
    return localStorage.getItem(storageKey(companyId)) || companyId;
  } catch {
    return companyId;
  }
}

function writeSeed(companyId: string, seed: string) {
  try {
    localStorage.setItem(storageKey(companyId), seed);
  } catch {
    // Storage full/unavailable — the avatar just won't persist across reloads.
  }
}

/** Persists each company's own DiceBear avatar seed in localStorage,
 *  independent from real company data (SQLite) — a per-device visual
 *  preference only, same pattern as the AI Copilot's local-first memory
 *  (see ai-copilot/copilotMemory.ts). Defaults to the company's own id so
 *  every company starts with a stable, distinct-looking avatar instead of
 *  every fresh company rendering identically until customized.
 *
 *  Re-reads from storage whenever `companyId` changes (not just on
 *  mount) — this hook lives inside WorkspaceAccountMenu, which stays
 *  mounted across a company switch, so the seed must follow the ACTIVE
 *  company rather than freezing at whichever one was active on first
 *  render. */
export function useCompanyAvatarSeed(companyId: string | undefined) {
  const [seed, setSeedState] = useState<string>(() => readSeed(companyId));

  useEffect(() => {
    setSeedState(readSeed(companyId));
  }, [companyId]);

  const setSeed = useCallback(
    (next: string) => {
      setSeedState(next);
      if (companyId) writeSeed(companyId, next);
    },
    [companyId]
  );

  return [seed, setSeed] as const;
}
