import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { lucia } from '../auth/lucia.js';
import { requireUser } from '../auth/middleware.js';
import { newId } from '../lib/id.js';

export const authRouter = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

authRouter.post('/register', async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { email, password } = parsed.data;

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const userId = newId('user');
  await db.insert(users).values({ id: userId, email, hashedPassword, role: 'user' });

  const session = await lucia.createSession(userId, {});
  const cookie = lucia.createSessionCookie(session.id);
  res.setHeader('Set-Cookie', cookie.serialize());
  res.status(201).json({ sessionId: session.id, user: { id: userId, email, role: 'user' } });
});

authRouter.post('/login', async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { email, password } = parsed.data;

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const validPassword = await bcrypt.compare(password, user.hashedPassword);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const session = await lucia.createSession(user.id, {});
  const cookie = lucia.createSessionCookie(session.id);
  res.setHeader('Set-Cookie', cookie.serialize());
  res.json({ sessionId: session.id, user: { id: user.id, email: user.email, role: user.role } });
});

authRouter.post('/logout', requireUser, async (req, res) => {
  const bearer = req.headers.authorization?.slice(7);
  const cookieSessionId = lucia.readSessionCookie(req.headers.cookie ?? '');
  const sessionId = bearer ?? cookieSessionId;
  if (sessionId) await lucia.invalidateSession(sessionId);
  const blankCookie = lucia.createBlankSessionCookie();
  res.setHeader('Set-Cookie', blankCookie.serialize());
  res.status(204).end();
});

authRouter.get('/me', requireUser, async (req, res) => {
  res.json({ user: req.user });
});
