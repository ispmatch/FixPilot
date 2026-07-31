import { Lucia } from 'lucia';
import { DrizzlePostgreSQLAdapter } from '@lucia-auth/adapter-drizzle';
import { db } from '../db/client.js';
import { sessions, users } from '../db/schema.js';

const adapter = new DrizzlePostgreSQLAdapter(db, sessions, users);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    // We're an API consumed by a React SPA + a WP plugin, not a
    // server-rendered site, so we don't rely on the cookie attributes
    // Lucia sets by default for same-site apps. See middleware.ts —
    // sessions are read from a Bearer token OR the cookie, either works.
    attributes: {
      secure: process.env.NODE_ENV === 'production',
    },
  },
  getUserAttributes: (attributes) => ({
    email: attributes.email,
    role: attributes.role,
  }),
});

declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      email: string;
      role: 'admin' | 'user';
    };
  }
}
