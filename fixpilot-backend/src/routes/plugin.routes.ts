import { Router } from 'express';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { domains } from '../db/schema.js';
import { requireDomainApiKey } from '../auth/middleware.js';
import { newId } from '../lib/id.js';

export const pluginRouter = Router();

const registerSchema = z.object({
  domain_name: z.string().min(1),
  owner_email: z.string().email(),
  domain_fingerprint: z.string().optional(),
  wp_version: z.string().optional(),
  php_version: z.string().optional(),
  active_theme: z.string().optional(),
  active_plugins: z.string().optional(),
});

/**
 * Open endpoint (no API key yet — the plugin doesn't have one on first
 * install). Called once when the plugin activates / loads the admin page
 * for the first time. Upserts by domain_name and returns the API key the
 * plugin should store and send as `x-fixpilot-key` on every future request.
 *
 * This is the direct equivalent of the plugin auto-registering against the
 * Base44 app on first admin page load, described in the original README.
 */
pluginRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const body = parsed.data;

  const [existing] = await db
    .select()
    .from(domains)
    .where(eq(domains.domainName, body.domain_name))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(domains)
      .set({
        domainFingerprint: body.domain_fingerprint,
        wpVersion: body.wp_version,
        phpVersion: body.php_version,
        activeTheme: body.active_theme,
        activePlugins: body.active_plugins,
        lastActive: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(domains.id, existing.id))
      .returning();
    return res.json({ domain_id: updated.id, api_key: updated.apiKey });
  }

  const apiKey = crypto.randomBytes(32).toString('hex');
  const [created] = await db
    .insert(domains)
    .values({
      id: newId('dom'),
      domainName: body.domain_name,
      domainFingerprint: body.domain_fingerprint,
      ownerEmail: body.owner_email,
      apiKey,
      wpVersion: body.wp_version,
      phpVersion: body.php_version,
      activeTheme: body.active_theme,
      activePlugins: body.active_plugins,
      lastActive: new Date(),
    })
    .returning();

  res.status(201).json({ domain_id: created.id, api_key: created.apiKey });
});

/** Lightweight heartbeat — equivalent of the sitePing function. */
pluginRouter.post('/ping', requireDomainApiKey, async (req, res) => {
  await db.update(domains).set({ lastActive: new Date() }).where(eq(domains.id, req.domain!.id));
  res.json({ ok: true });
});
