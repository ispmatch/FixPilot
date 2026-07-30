import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.routes.js';
import { entitiesRouter } from './routes/entities.routes.js';
import { pluginRouter } from './routes/plugin.routes.js';

const app = express();

app.use(
  cors({
    origin: process.env.DASHBOARD_ORIGIN?.split(',') ?? true,
    credentials: true,
  }),
);
app.use(express.json({ limit: '5mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'fixpilot-backend' }));

app.use('/api/auth', authRouter);
app.use('/api', entitiesRouter);
app.use('/api/plugin', pluginRouter);

// TODO (next step): mount the AI fix orchestrator here, e.g.
// app.use('/api/orchestrator', orchestratorRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => {
  console.log(`FixPilot backend listening on :${port}`);
});
