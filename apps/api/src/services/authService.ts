import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { env } from "../env.js";

export interface AccessTokenPayload {
  sub: string; // user id
  orgId: string;
  role: string;
}

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "30d";
export const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const hashPassword = (plain: string) => argon2.hash(plain);

export const verifyPassword = (hash: string, plain: string) => argon2.verify(hash, plain);

export const signAccessToken = (payload: AccessTokenPayload) =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL });

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload & jwt.JwtPayload;

// Refresh tokens are stateless JWTs for this first slice — enough to prove
// the login/session flow end-to-end. They cannot be individually revoked
// before they expire; a `refresh_tokens` table (store a hash, check on use,
// delete on logout) is a fast-follow before this handles real user data.
export const signRefreshToken = (payload: { sub: string }) =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string } & jwt.JwtPayload;
