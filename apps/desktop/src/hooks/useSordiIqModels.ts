import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export interface SordiIqModelOption {
  id: string;
  name: string;
}

/** OpenRouter keys are "sk-or-v1-" + a long hex string — well short of this
 *  length means the user is still mid-typing, not worth a request yet. */
const MIN_KEY_LENGTH = 20;
const DEBOUNCE_MS = 500;

/**
 * Live OpenRouter model catalog for the Settings dialog's dropdown — calls
 * the sordi_iq_list_models Tauri command (GET /api/v1/models under the
 * hood), debounced against the API key input so it fires once typing
 * settles, not on every keystroke. Returns the fetched models, loading and
 * error state, so the dropdown can show a spinner/warning without the
 * caller re-deriving any of this itself.
 */
export function useSordiIqModels(apiKey: string) {
  const [debouncedKey, setDebouncedKey] = useState(apiKey);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKey(apiKey), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [apiKey]);

  const trimmed = debouncedKey.trim();
  const query = useQuery({
    queryKey: ["sordi-iq-models", trimmed],
    queryFn: () => invoke<SordiIqModelOption[]>("sordi_iq_list_models", { apiKey: trimmed }),
    enabled: trimmed.length >= MIN_KEY_LENGTH,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return {
    models: query.data ?? [],
    isLoading: query.isFetching,
    error: query.error instanceof Error ? query.error.message : (query.error as string | undefined),
    // True once the debounce has settled and a request is actually eligible
    // to fire — lets the UI distinguish "still typing" from "nothing to
    // fetch" without duplicating the length check.
    isEligible: trimmed.length >= MIN_KEY_LENGTH,
  };
}
