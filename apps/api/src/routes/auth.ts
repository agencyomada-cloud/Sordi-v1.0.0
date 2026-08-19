import { Router } from "express";
import { signupSchema, loginSchema } from "@sordi/schema";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { accountsRepo } from "../repositories/accounts.js";
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  REFRESH_COOKIE_MAX_AGE_MS,
} from "../services/authService.js";
export const authRouter = Router();

const REFRESH_COOKIE = "sordi_refresh";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  path: "/auth",
};

function issueSession(res: import("express").Response, userId: string, orgId: string, role: string) {
  const accessToken = signAccessToken({ sub: userId, orgId, role });
  const refreshToken = signRefreshToken({ sub: userId });
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
  return accessToken;
}

authRouter.post("/signup", asyncHandler(async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", issues: parsed.error.flatten() });
    return;
  }
  const { email, password, organizationName } = parsed.data;

  const existing = await accountsRepo.findUserByEmail(email);
  if (existing) {
    res.status(409).json({ error: "email_taken", message: "An account with this email already exists." });
    return;
  }

  const passwordHash = await hashPassword(password);
  const { user, org, membership } = await accountsRepo.signup(email, passwordHash, organizationName);

  const accessToken = issueSession(res, user.id, org.id, membership.role);
  res.status(201).json({
    accessToken,
    user: { id: user.id, email: user.email },
    organization: { id: org.id, name: org.name },
    role: membership.role,
  });
}));

authRouter.post("/login", asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", issues: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;

  const user = await accountsRepo.findUserByEmail(email);
  const passwordOk = user ? await verifyPassword(user.passwordHash, password) : false;
  if (!user || !passwordOk) {
    res.status(401).json({ error: "invalid_credentials", message: "Incorrect email or password." });
    return;
  }

  const membership = await accountsRepo.findMembershipForUser(user.id);
  if (!membership) {
    res.status(403).json({ error: "no_organization", message: "This account has no organization." });
    return;
  }

  const accessToken = issueSession(res, user.id, membership.orgId, membership.role);
  res.json({
    accessToken,
    user: { id: user.id, email: user.email },
    role: membership.role,
  });
}));

authRouter.post("/refresh", asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) {
    res.status(401).json({ error: "missing_refresh_token" });
    return;
  }

  try {
    const payload = verifyRefreshToken(token);
    const membership = await accountsRepo.findMembershipForUser(payload.sub);
    if (!membership) {
      res.status(403).json({ error: "no_organization" });
      return;
    }
    const accessToken = signAccessToken({ sub: payload.sub, orgId: membership.orgId, role: membership.role });
    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: "invalid_refresh_token" });
  }
}));

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(REFRESH_COOKIE, { path: "/auth" });
  res.status(204).end();
});
