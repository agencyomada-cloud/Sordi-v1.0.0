import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export interface UpdateInfo {
  current_version: string;
  latest_version: string;
  update_available: boolean;
  release_notes: string;
  download_url: string;
}

/** Backs both the header's update badge and Settings' "À propos" line.
 *  1h staleTime — an update check doesn't need to be more real-time than
 *  that, and this avoids hitting the API on every window focus. Errors
 *  (offline, server down) are silent by design: `data` just stays
 *  undefined, same as any other network hiccup this app already tolerates
 *  quietly (see license.rs's own background-verify). */
export function useUpdateCheck() {
  return useQuery({
    queryKey: ["updates", "latest"],
    queryFn: () => invoke<UpdateInfo>("check_for_updates"),
    staleTime: 60 * 60_000,
    retry: false,
  });
}
