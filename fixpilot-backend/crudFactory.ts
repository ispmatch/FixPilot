import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  doublePrecision,
  index,
} from 'drizzle-orm/pg-core';

// ─────────────────────────────────────────────────────────────────────────
// Auth (Lucia v3) — replaces base44.auth.*
// ─────────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  hashedPassword: text('hashed_password').notNull(),
  role: text('role', { enum: ['admin', 'user'] }).notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// ─────────────────────────────────────────────────────────────────────────
// Domain — registered WordPress sites
// ─────────────────────────────────────────────────────────────────────────

export const domains = pgTable(
  'domains',
  {
    id: text('id').primaryKey(),
    domainName: text('domain_name').notNull(),
    domainFingerprint: text('domain_fingerprint'),
    apiKey: text('api_key').notNull(),
    ownerName: text('owner_name'),
    ownerEmail: text('owner_email').notNull(),
    subscriptionTier: text('subscription_tier', {
      enum: ['free', 'starter', 'pro', 'business'],
    })
      .notNull()
      .default('free'),
    fixCountUsed: integer('fix_count_used').notNull().default(0),
    fixCountLimit: integer('fix_count_limit').notNull().default(3),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    subscriptionStatus: text('subscription_status', {
      enum: ['none', 'active', 'cancelled', 'past_due'],
    })
      .notNull()
      .default('none'),
    wpVersion: text('wp_version'),
    phpVersion: text('php_version'),
    activeTheme: text('active_theme'),
    activePlugins: text('active_plugins'),
    lastActive: timestamp('last_active', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    domainNameIdx: index('domains_domain_name_idx').on(t.domainName),
    apiKeyIdx: index('domains_api_key_idx').on(t.apiKey),
    ownerEmailIdx: index('domains_owner_email_idx').on(t.ownerEmail),
  }),
);

// ─────────────────────────────────────────────────────────────────────────
// FixExecution — individual fix records
// ─────────────────────────────────────────────────────────────────────────

export const fixExecutions = pgTable(
  'fix_executions',
  {
    id: text('id').primaryKey(),
    domainId: text('domain_id').references(() => domains.id, { onDelete: 'set null' }),
    domainName: text('domain_name').notNull(),
    userEmail: text('user_email'),
    fixDescription: text('fix_description').notNull(),
    fixCategory: text('fix_category', {
      enum: ['css', 'settings', 'content', 'database', 'other'],
    })
      .notNull()
      .default('other'),
    jsonInstruction: jsonb('json_instruction'),
    beforeState: jsonb('before_state'),
    afterState: jsonb('after_state'),
    status: text('status', { enum: ['applied', 'reverted', 'failed'] })
      .notNull()
      .default('applied'),
    verificationStatus: text('verification_status', {
      enum: ['pending', 'passed', 'failed', 'manual', 'skipped'],
    })
      .notNull()
      .default('pending'),
    verificationPlan: jsonb('verification_plan'),
    verificationResult: jsonb('verification_result'),
    wpVersion: text('wp_version'),
    pluginVersions: jsonb('plugin_versions'),
    recipeId: text('recipe_id'),
    setupFingerprint: text('setup_fingerprint'),
    builderType: text('builder_type', {
      enum: [
        'elementor',
        'divi',
        'beaver_builder',
        'brizy',
        'siteorigin',
        'thrust',
        'gutenberg',
        'unknown',
        '',
      ],
    }).default('unknown'),
    changeTypesUsed: jsonb('change_types_used'),
    themeName: text('theme_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    domainIdIdx: index('fix_executions_domain_id_idx').on(t.domainId),
  }),
);

// ─────────────────────────────────────────────────────────────────────────
// FixRecipe — verified fix templates (learning KB)
// ─────────────────────────────────────────────────────────────────────────

export const fixRecipes = pgTable('fix_recipes', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category', {
    enum: ['css', 'settings', 'content', 'database', 'other'],
  })
    .notNull()
    .default('other'),
  fixTemplate: jsonb('fix_template'),
  wpVersionRange: text('wp_version_range'),
  pluginName: text('plugin_name'),
  pluginVersionRange: text('plugin_version_range'),
  status: text('status', { enum: ['draft', 'verified', 'deprecated'] })
    .notNull()
    .default('draft'),
  successCount: integer('success_count').notNull().default(0),
  failureCount: integer('failure_count').notNull().default(0),
  totalCount: integer('total_count').notNull().default(0),
  tags: jsonb('tags'),
  builderType: text('builder_type', {
    enum: [
      'elementor',
      'divi',
      'beaver_builder',
      'brizy',
      'siteorigin',
      'thrust',
      'gutenberg',
      'unknown',
      '',
    ],
  }).default('unknown'),
  themeName: text('theme_name'),
  setupTags: jsonb('setup_tags'),
  failedApproaches: jsonb('failed_approaches'),
  effectiveApproach: text('effective_approach'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────
// PluginCapability — plugin/theme knowledge base
// ─────────────────────────────────────────────────────────────────────────

export const pluginCapabilities = pgTable(
  'plugin_capabilities',
  {
    id: text('id').primaryKey(),
    pluginSlug: text('plugin_slug').notNull(),
    pluginName: text('plugin_name'),
    structuralCategory: text('structural_category', {
      enum: [
        'builder',
        'ecommerce',
        'forms',
        'seo',
        'custom_data',
        'security',
        'performance',
        'communication',
        'media',
        'general',
      ],
    }).default('general'),
    capabilityType: text('capability_type', {
      enum: [
        'rest_endpoint',
        'option_key',
        'hook',
        'shortcode',
        'class_method',
        'database_table',
        'widget_schema',
        'general_doc',
      ],
    })
      .notNull()
      .default('general_doc'),
    widgetType: text('widget_type'),
    nativeProperties: jsonb('native_properties'),
    identifier: text('identifier').notNull(),
    method: text('method'),
    description: text('description'),
    requiredParams: jsonb('required_params'),
    exampleUsage: text('example_usage'),
    fixGuidance: text('fix_guidance'),
    confidenceScore: doublePrecision('confidence_score').notNull().default(0.5),
    sourceUrl: text('source_url'),
    sourceType: text('source_type', {
      enum: ['official_docs', 'vendor_blog', 'github_issue', 'forum_post', 'llm_synthesized'],
    }).default('official_docs'),
    knowledgeDepth: text('knowledge_depth', { enum: ['none', 'partial', 'comprehensive'] }).default(
      'partial',
    ),
    versionTested: text('version_tested'),
    lastIngested: timestamp('last_ingested', { withTimezone: true }),
  },
  (t) => ({
    pluginSlugIdx: index('plugin_capabilities_plugin_slug_idx').on(t.pluginSlug),
  }),
);

// ─────────────────────────────────────────────────────────────────────────
// SiteSetupProfile — site fingerprints
// ─────────────────────────────────────────────────────────────────────────

export const siteSetupProfiles = pgTable('site_setup_profiles', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').references(() => domains.id, { onDelete: 'set null' }),
  domainName: text('domain_name').notNull(),
  platform: text('platform', { enum: ['wordpress', 'shopify'] }).notNull().default('wordpress'),
  setupFingerprint: text('setup_fingerprint'),
  themeName: text('theme_name'),
  builderType: text('builder_type', {
    enum: [
      'elementor',
      'divi',
      'beaver_builder',
      'brizy',
      'siteorigin',
      'thrust',
      'gutenberg',
      'unknown',
    ],
  })
    .notNull()
    .default('unknown'),
  stackManifest: jsonb('stack_manifest'),
  activePlugins: jsonb('active_plugins'),
  cssClassPatterns: jsonb('css_class_patterns'),
  navStructure: jsonb('nav_structure'),
  bodyClasses: text('body_classes'),
  wpVersion: text('wp_version'),
  phpVersion: text('php_version'),
  fixesAttempted: integer('fixes_attempted').notNull().default(0),
  fixesSuccessful: integer('fixes_successful').notNull().default(0),
  fixesFailed: integer('fixes_failed').notNull().default(0),
  failedApproaches: jsonb('failed_approaches'),
  effectiveApproaches: jsonb('effective_approaches'),
  lastUpdated: timestamp('last_updated', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────
// ChatSession / ChatMessage
// ─────────────────────────────────────────────────────────────────────────

export const chatSessions = pgTable('chat_sessions', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').references(() => domains.id, { onDelete: 'set null' }),
  domainName: text('domain_name').notNull(),
  userEmail: text('user_email'),
  status: text('status', { enum: ['active', 'closed'] }).notNull().default('active'),
  siteContext: jsonb('site_context'),
  title: text('title'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => chatSessions.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
    content: text('content').notNull(),
    fixProposal: jsonb('fix_proposal'),
    fixStatus: text('fix_status', {
      enum: ['pending', 'confirmed', 'rejected', 'applied', 'reverted'],
    }).default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdIdx: index('chat_messages_session_id_idx').on(t.sessionId),
  }),
);

// ─────────────────────────────────────────────────────────────────────────
// SiteHealthScan / VulnerabilityScan / SiteAudit
// ─────────────────────────────────────────────────────────────────────────

export const siteHealthScans = pgTable('site_health_scans', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').references(() => domains.id, { onDelete: 'set null' }),
  domainName: text('domain_name').notNull(),
  scanDate: timestamp('scan_date', { withTimezone: true }).notNull().defaultNow(),
  status: text('status', { enum: ['scanning', 'completed', 'error'] }).notNull().default('scanning'),
  progress: integer('progress').notNull().default(0),
  currentStep: text('current_step'),
  issues: jsonb('issues'),
  totalIssues: integer('total_issues').notNull().default(0),
  siteSnapshot: jsonb('site_snapshot'),
});

export const vulnerabilityScans = pgTable('vulnerability_scans', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').references(() => domains.id, { onDelete: 'set null' }),
  domainName: text('domain_name').notNull(),
  scanDate: timestamp('scan_date', { withTimezone: true }).notNull().defaultNow(),
  status: text('status', { enum: ['clean', 'warning', 'critical', 'error'] })
    .notNull()
    .default('clean'),
  vulnerabilitiesFound: integer('vulnerabilities_found').notNull().default(0),
  scanDetails: text('scan_details'),
  vulnerabilities: jsonb('vulnerabilities'),
  wpVersion: text('wp_version'),
  activePlugins: jsonb('active_plugins'),
  acknowledged: boolean('acknowledged').notNull().default(false),
});

export const siteAudits = pgTable('site_audits', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').references(() => domains.id, { onDelete: 'set null' }),
  domainName: text('domain_name').notNull(),
  auditDate: timestamp('audit_date', { withTimezone: true }).notNull().defaultNow(),
  changeType: text('change_type', {
    enum: [
      'plugin_activated',
      'plugin_deactivated',
      'theme_change',
      'file_modified',
      'setting_changed',
      'user_created',
      'user_deleted',
      'core_updated',
      'other',
    ],
  })
    .notNull()
    .default('other'),
  description: text('description').notNull(),
  diffDetails: jsonb('diff_details'),
  detectedBy: text('detected_by', { enum: ['plugin', 'scheduled_scan', 'manual'] })
    .notNull()
    .default('plugin'),
  severity: text('severity', { enum: ['info', 'warning', 'critical'] }).notNull().default('info'),
  acknowledged: boolean('acknowledged').notNull().default(false),
});

// ─────────────────────────────────────────────────────────────────────────
// StagedFix / NotificationChannel
// ─────────────────────────────────────────────────────────────────────────

export const stagedFixes = pgTable('staged_fixes', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').references(() => domains.id, { onDelete: 'set null' }),
  domainName: text('domain_name').notNull(),
  fixExecutionId: text('fix_execution_id'),
  fixDescription: text('fix_description').notNull(),
  stagingUrl: text('staging_url'),
  previewToken: text('preview_token'),
  status: text('status', {
    enum: ['creating', 'ready', 'testing', 'approved', 'rejected', 'expired', 'error'],
  })
    .notNull()
    .default('creating'),
  stagingConfig: jsonb('staging_config'),
  verificationResult: jsonb('verification_result'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  mergedToLive: boolean('merged_to_live').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notificationChannels = pgTable('notification_channels', {
  id: text('id').primaryKey(),
  domainId: text('domain_id').references(() => domains.id, { onDelete: 'cascade' }),
  domainName: text('domain_name').notNull(),
  channelType: text('channel_type', { enum: ['slack', 'discord', 'email', 'webhook'] })
    .notNull()
    .default('slack'),
  webhookUrl: text('webhook_url').notNull(),
  channelName: text('channel_name'),
  events: jsonb('events'),
  isActive: boolean('is_active').notNull().default(true),
  lastTriggered: timestamp('last_triggered', { withTimezone: true }),
});
