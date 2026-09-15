import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db, type SordiIqSessionSummary, type SordiIqSession, type SordiIqStoredMessage } from "@/lib/database";

/** The sidebar's session list — title, timestamps, and a short preview
 *  only (see db.sordiIq.listSessions's own note on why). */
export function useSordiIqSessions() {
  return useQuery({
    queryKey: ["sordi-iq-sessions"],
    queryFn: () => db.sordiIq.listSessions(),
  });
}

/** Full message history for one session, fetched on selection. `null`/
 *  undefined id disables the query (no session selected yet). */
export function useSordiIqSession(id: string | null) {
  return useQuery({
    queryKey: ["sordi-iq-session", id],
    queryFn: () => db.sordiIq.getSession(id as string),
    enabled: !!id,
  });
}

export function useCreateSordiIqSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => db.sordiIq.createSession(),
    onSuccess: (session: SordiIqSessionSummary) => {
      queryClient.setQueryData<SordiIqSessionSummary[]>(["sordi-iq-sessions"], (prev) => [session, ...(prev ?? [])]);
    },
  });
}

/** Persists a session's full turn history after each exchange — silent
 *  (no toast) since this fires automatically after every assistant reply,
 *  not from an explicit user "save" action. */
export function useSaveSordiIqSessionMessages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, messages }: { id: string; messages: SordiIqStoredMessage[] }) => db.sordiIq.saveMessages(id, messages),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["sordi-iq-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["sordi-iq-session", id] });
    },
  });
}

export function useDeleteSordiIqSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.sordiIq.deleteSession(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<SordiIqSessionSummary[]>(["sordi-iq-sessions"], (prev) => (prev ?? []).filter((s) => s.id !== id));
      queryClient.removeQueries({ queryKey: ["sordi-iq-session", id] });
    },
  });
}

export type { SordiIqSession, SordiIqSessionSummary, SordiIqStoredMessage };
