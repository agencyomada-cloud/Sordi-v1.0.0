import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/database";
import { useDebouncedValue } from "./useDebouncedValue";

const MIN_QUERY_LENGTH = 2;

export function useGlobalSearch(rawQuery: string) {
  const query = useDebouncedValue(rawQuery.trim(), 150);
  const enabled = query.length >= MIN_QUERY_LENGTH;

  const result = useQuery({
    queryKey: ["global-search", query],
    queryFn: () => db.search.global(query),
    enabled,
    // Bounded local queries (~1-3ms) — no reason to hold onto a stale
    // result once the user changes what they typed.
    staleTime: 0,
  });

  return {
    ...result,
    // Distinguishes "haven't typed enough yet" from "typed enough, no
    // matches" for the empty-state message in the palette.
    isBelowMinLength: !enabled,
  };
}
