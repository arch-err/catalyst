import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { config } from './config.js';
import type { ApiResponse, AuthCheckResponse } from '@catalyst/shared';

export const authRouter = Router();

const COOKIE_NAME = 'catalyst_session';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

authRouter.post('/login', (req: Request, res: Response) => {
  const { secret } = req.body as { secret?: string };
  if (!secret) {
    res.status(400).json({ ok: false, error: 'Secret required' } satisfies ApiResponse);
    return;
  }

  // Timing-safe comparison
  const input = Buffer.from(secret);
  const expected = Buffer.from(config.catalystSecret);
  if (input.length !== expected.length || !crypto.timingSafeEqual(input, expected)) {
    res.status(401).json({ ok: false, error: 'Invalid secret' } satisfies ApiResponse);
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    signed: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  // Store token for validation
  validTokens.add(token);

  res.json({ ok: true } satisfies ApiResponse);
});

authRouter.post('/logout', (_req: Request, res: Response) => {
  const token = _req.signedCookies?.[COOKIE_NAME];
  if (token) validTokens.delete(token);
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true } satisfies ApiResponse);
});

authRouter.get('/auth/check', (req: Request, res: Response) => {
  const token = req.signedCookies?.[COOKIE_NAME];
  const authenticated = !!token && validTokens.has(token);
  res.json({ ok: true, data: { authenticated } } satisfies ApiResponse<AuthCheckResponse>);
});

// In-memory token store (single user, acceptable)
const validTokens = new Set<string>();

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.signedCookies?.[COOKIE_NAME];
  if (!token || !validTokens.has(token)) {
    res.status(401).json({ ok: false, error: 'Unauthorized' } satisfies ApiResponse);
    return;
  }
  next();
}

// Export for WebSocket auth
export function verifyToken(token: string): boolean {
  return validTokens.has(token);
}

export { COOKIE_NAME };
