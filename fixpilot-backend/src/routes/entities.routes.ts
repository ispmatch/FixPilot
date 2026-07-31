import { Router } from 'express';
import { crudRouter } from './crudFactory.js';
import {
  domains,
  fixExecutions,
  fixRecipes,
  pluginCapabilities,
  siteSetupProfiles,
  chatSessions,
  chatMessages,
  siteHealthScans,
  vulnerabilityScans,
  siteAudits,
  stagedFixes,
  notificationChannels,
} from '../db/schema.js';

export const entitiesRouter = Router();

// Mirrors the base44.entities.<Name> surface the React dashboard used to call.
entitiesRouter.use('/domains', crudRouter(domains, 'dom'));
entitiesRouter.use('/fix-executions', crudRouter(fixExecutions, 'fix'));
entitiesRouter.use('/fix-recipes', crudRouter(fixRecipes, 'rcp'));
entitiesRouter.use('/plugin-capabilities', crudRouter(pluginCapabilities, 'cap'));
entitiesRouter.use('/site-setup-profiles', crudRouter(siteSetupProfiles, 'ssp'));
entitiesRouter.use('/chat-sessions', crudRouter(chatSessions, 'cs'));
entitiesRouter.use('/chat-messages', crudRouter(chatMessages, 'cm'));
entitiesRouter.use('/site-health-scans', crudRouter(siteHealthScans, 'shs'));
entitiesRouter.use('/vulnerability-scans', crudRouter(vulnerabilityScans, 'vs'));
entitiesRouter.use('/site-audits', crudRouter(siteAudits, 'aud'));
entitiesRouter.use('/staged-fixes', crudRouter(stagedFixes, 'stg'));
entitiesRouter.use('/notification-channels', crudRouter(notificationChannels, 'nc'));
