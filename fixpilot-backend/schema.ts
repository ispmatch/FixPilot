import type { NextFunction, Request, Response } from 'express';
import { lucia } from './lucia.js';
import { db } from '../db/client.js';
import { domains } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string; role: 'admin' | 'user' };
      domain?: typeof domains.$inferSelect;
    }
  }
}

/**
 * Validates a dashboard user session. Accepts either the Lucia session
 * cookie (used by the React app in a browser) or an `Authorization: Bearer
 * <sessionId>` header (useful for non-browser clients / testing).
 * Replaces base44.auth.me() / requiresAuth checks.
 */
export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const cookieSessionId = lucia.readSessionCookie(req.headers.cookie ?? '');
  const sessionId = bearer ?? cookieSessionId;

  if (!sessionId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { session, user } = await lucia.validateSession(sessionId);
  if (!session || !user) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }

  req.user = { id: user.id, email: user.email, role: user.role };
  next();
}

/**
 * Validates requests coming FROM the WordPress plugin, authenticated by
 * the per-domain API key (mirrors the plugin's own `hash_equals()` check
 * in class-rest-api.php). Attaches the matched domain row to req.domain.
 */
export async function requireDomainApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = (req.headers['x-fixpilot-key'] as string | undefined) ?? '';
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-fixpilot-key header' });
  }

  const [domain] = await db.select().from(domains).where(eq(domains.apiKey, apiKey)).limit(1);

  if (!domain || !timingSafeEqual(domain.apiKey, apiKey)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  req.domain = domain;
  next();
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
