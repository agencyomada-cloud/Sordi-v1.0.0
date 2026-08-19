import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../services/authService.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { userId: string; orgId: string; role: string };
    }
  }
}

/**
 * The single gate every business route goes through. It never trusts an
 * orgId from the request body or query string — only from a verified JWT —
 * so a caller cannot ask for another organization's data by simply passing
 * a different id.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    res.status(401).json({ error: "missing_token", message: "Sign in to continue." });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub, orgId: payload.orgId, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: "invalid_token", message: "Your session expired — sign in again." });
  }
}
