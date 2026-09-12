import { Router } from "express";
import { env } from "../env.js";

export const releasesRouter = Router();

// Public — the desktop app's update check (apps/desktop/src-tauri/src/
// updates.rs) hits this unauthenticated, same trust model as
// GET /health. No release history/admin UI behind this: the API always
// reports whatever LATEST_APP_VERSION/RELEASE_NOTES are set to right now,
// bumped by hand alongside every real release.
releasesRouter.get("/latest", (_req, res) => {
  res.json({
    latestVersion: env.LATEST_APP_VERSION,
    releaseNotes: env.RELEASE_NOTES,
    downloadUrl: `${env.SITE_ORIGIN}${env.DOWNLOAD_URL_MACOS}`,
  });
});
