import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { requireUser } from '../auth/middleware.js';
import { newId } from '../lib/id.js';

/**
 * Generic REST CRUD router for a single entity table, replacing the
 * auto-generated `base44.entities.<Name>` client the frontend used to call.
 * Mounted at e.g. /api/domains, /api/fix-executions, etc.
 *
 * Typed loosely (table: any) on purpose — Drizzle's PgTable generics don't
 * factor cleanly into a shared helper, and every table here follows the
 * same shape (text id primary key), so runtime behavior is what matters.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function crudRouter(table: any, idPrefix: string) {
  const router = Router();
  router.use(requireUser);

  router.get('/', async (_req, res) => {
    const rows = await db.select().from(table);
    res.json(rows);
  });

  router.get('/:id', async (req, res) => {
    const [row] = await db.select().from(table).where(eq(table.id, req.params.id)).limit(1);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });

  router.post('/', async (req, res) => {
    const id = newId(idPrefix);
    const [row] = await db
      .insert(table)
      .values({ ...req.body, id })
      .returning();
    res.status(201).json(row);
  });

  router.patch('/:id', async (req, res) => {
    const { id: _ignored, ...updates } = req.body ?? {};
    const [row] = await db
      .update(table)
      .set(updates)
      .where(eq(table.id, req.params.id))
      .returning();
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });

  router.delete('/:id', async (req, res) => {
    const [row] = await db.delete(table).where(eq(table.id, req.params.id)).returning();
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  });

  return router;
}
