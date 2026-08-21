import { useQuery } from "@tanstack/react-query";
import { appDataDir, join } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";

/**
 * app_data_dir never changes during a run, and every employee_photos/
 * employee_documents path stored in the DB is relative to it — so this is
 * fetched once and cached forever, rather than re-resolved per avatar/row.
 */
export function useAppDataDir() {
  return useQuery({
    queryKey: ["app-data-dir"],
    queryFn: () => appDataDir(),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/** Builds a webview-loadable asset:// URL for a path stored relative to app_data_dir. */
export async function resolveAppDataFileUrl(appDataDirPath: string, relativePath: string): Promise<string> {
  const absolute = await join(appDataDirPath, relativePath);
  return convertFileSrc(absolute);
}

/** Absolute filesystem path for a path stored relative to app_data_dir — for openPath(), not for <img src>. */
export async function resolveAppDataAbsolutePath(appDataDirPath: string, relativePath: string): Promise<string> {
  return join(appDataDirPath, relativePath);
}
