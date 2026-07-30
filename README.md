# FixPilot.cloud — Complete Codebase Export

**Version:** 1.7.5  
**Export Date:** 2026-07-11  
**Platform:** Base44 (React + Vite + Deno Deploy backend) + WordPress Plugin

---

## What is FixPilot?

FixPilot is an intelligent WordPress sidekick that provides AI-driven styling, code fixes, and automated site maintenance for WordPress users. It consists of two main components:

1. **WordPress Plugin** (`wordpress-plugin/`) — PHP plugin that installs on a WordPress site, provides a chat panel in the admin, and executes AI-proposed fixes directly on the site.
2. **Cloud App** (`cloud-app/`) — React frontend dashboard + Deno Deploy backend functions that power the AI orchestration, knowledge base, billing, and site management.

---

## Directory Structure

```
FixPilot-Codebase/
├── README.md                          ← You are here
│
├── wordpress-plugin/                  ← WordPress plugin (install on WP site)
│   ├── fixpilot.php                   ← Main plugin file (v1.7.5)
│   ├── includes/
│   │   ├── class-rest-api.php         ← REST API controller (endpoints, auth, Elementor map, Woo data)
│   │   ├── class-fix-applier.php      ← Fix execution engine (CSS inject, post/meta update, Elementor patching)
│   │   ├── class-rollback.php          ← Rollback engine (revert applied fixes)
│   │   └── class-panel.php             ← Admin panel renderer (injects chat UI)
│   ├── assets/
│   │   ├── css/
│   │   │   ├── panel.css               ← Chat panel styles
│   │   │   └── admin-dashboard.css     ← Admin dashboard styles
│   │   └── js/
│   │       ├── panel.js                ← Chat panel logic (messaging, file upload, fix execution)
│   │       └── admin-dashboard.js      ← Admin dashboard logic (stats, billing, history, learning progress)
│   └── readme.txt                      ← WordPress plugin readme
│
└── cloud-app/                         ← Cloud application (React + Deno backend)
    ├── index.html                     ← Vite HTML entry
    ├── package.json                   ← NPM dependencies
    ├── vite.config.js                 ← Vite build config
    ├── tailwind.config.js             ← Tailwind CSS config
    ├── postcss.config.js              ← PostCSS config
    ├── jsconfig.json                  ← JS path aliases (@/ = src/)
    ├── components.json                 ← shadcn/ui config
    ├── eslint.config.js               ← ESLint config
    ├── README.md                       ← Project readme
    ├── CLAUDE.md                      ← AI agent instructions
    ├── AGENTS.md                      ← Agent guidelines
    │
    ├── src/                           ← React frontend source
    │   ├── App.jsx                    ← Router (all routes)
    │   ├── main.jsx                   ← Vite entry point
    │   ├── index.css                  ← Global CSS (design tokens, dark theme)
    │   ├── pages/                     ← All pages:
    │   │   ├── Home.jsx               ← Dashboard (stats, site health, recent fixes)
    │   │   ├── ChatPanel.jsx          ← AI chat interface (research, fix proposals, verification)
    │   │   ├── FixHistory.jsx         ← Fix execution history
    │   │   ├── Subscription.jsx       ← Stripe subscription management
    │   │   ├── Customers.jsx          ← Domain/customer management
    │   │   ├── KnowledgeBase.jsx       ← FixRecipe & PluginCapability KB viewer
    │   │   ├── PluginDownload.jsx     ← Plugin ZIP download page
    │   │   ├── VulnerabilityScans.jsx ← Security scan results
    │   │   ├── SiteAuditLog.jsx       ← Site change audit trail
    │   │   ├── Notifications.jsx      ← Notification channel config
    │   │   ├── StagedFixes.jsx        ← Staged fix preview management
    │   │   ├── Login.jsx             ← Auth login
    │   │   ├── Register.jsx           ← Auth register
    │   │   ├── ForgotPassword.jsx     ← Password reset request
    │   │   └── ResetPassword.jsx      ← Password reset
    │   ├── components/
    │   │   ├── Layout.jsx             ← Main layout (sidebar + topbar)
    │   │   ├── ProtectedRoute.jsx     ← Auth guard
    │   │   ├── ScrollToTop.jsx        ← Scroll restoration
    │   │   ├── Logo.jsx               ← FixPilot logo
    │   │   ├── AuthLayout.jsx         ← Auth page wrapper
    │   │   ├── GoogleIcon.jsx         ← Google OAuth icon
    │   │   ├── UserNotRegisteredError.jsx
    │   │   ├── chat/                  ← Chat-specific components
    │   │   │   ├── FixProposalCard.jsx
    │   │   │   ├── VerificationResults.jsx
    │   │   │   ├── ChatHistory.jsx
    │   │   │   └── XaiReport.jsx
    │   │   ├── dashboard/             ← Dashboard widgets
    │   │   │   ├── StatCard.jsx
    │   │   │   ├── SiteHealthHub.jsx
    │   │   │   └── SiteStatusPing.jsx
    │   │   └── ui/                    ← shadcn/ui component library (40+ components)
    │   ├── lib/
    │   │   ├── AuthContext.jsx         ← Auth provider (login/logout/token management)
    │   │   ├── version.js              ← App version constant
    │   │   ├── pluginFiles/           ← WordPress plugin source files (as JS template literals)
    │   │   │   ├── index.js            ← Aggregator
    │   │   │   ├── fixpilotPhp.js      ← Main plugin PHP
    │   │   │   ├── restApiPhp.js       ← REST API PHP
    │   │   │   ├── fixApplierPhp.js   ← Fix applier PHP
    │   │   │   ├── rollbackPhp.js     ← Rollback PHP
    │   │   │   └── panelAndAssets.js  ← Panel + CSS + JS + admin dashboard + readme
    │   │   ├── pluginPhpFiles.js       ← Re-export alias
    │   │   ├── query-client.js         ← React Query client
    │   │   ├── app-params.js           ← App config params
    │   │   ├── PageNotFound.jsx        ← 404 page
    │   │   └── utils.js                ← Utility functions
    │   ├── hooks/
    │   │   └── use-mobile.jsx          ← Mobile detection hook
    │   ├── api/
    │   │   └── base44Client.js         ← Base44 SDK client (pre-initialized)
    │   └── utils/
    │       └── index.ts               ← Utility exports
    │
    └── base44/                        ← Backend (Deno Deploy)
        ├── config.jsonc               ← Base44 app config
        ├── entities/                  ← Database schemas (JSON):
        │   ├── Domain.jsonc           ← Registered sites (URL, API key, subscription, WP/PHP versions)
        │   ├── FixExecution.jsonc     ← Fix records (before/after state, verification, change types)
        │   ├── FixRecipe.jsonc        ← Verified fix templates (success/failure stats, builder-specific)
        │   ├── ChatSession.jsonc       ← Chat conversation sessions
        │   ├── ChatMessage.jsonc      ← Individual chat messages (with fix proposals)
        │   ├── PluginCapability.jsonc  ← Plugin knowledge base (REST endpoints, option keys, hooks)
        │   ├── SiteSetupProfile.jsonc  ← Site setup fingerprints (builder, theme, plugins, CSS patterns)
        │   ├── SiteHealthScan.jsonc   ← Health scan results (issues, progress, recommendations)
        │   ├── VulnerabilityScan.jsonc ← Security vulnerability scan results
        │   ├── SiteAudit.jsonc        ← Site change audit log
        │   ├── StagedFix.jsonc        ← Staged fix preview records
        │   └── NotificationChannel.jsonc ← Slack/Discord/email/webhook notification config
        ├── functions/                 ← Backend functions (Deno):
        │   ├── aiFixOrchestrator/     ← Core AI engine: research, propose, execute, verify, rollback, deep think
        │   ├── pluginUpdateCheck/     ← Plugin auto-update system (version check, ZIP serving)
        │   ├── pluginKnowledgeIngester/ ← Plugin/theme capability research & KB population
        │   ├── widgetSchemaRegistry/  ← Elementor/Divi/Beaver widget schema registry
        │   ├── siteStackDiscovery/   ← Proactive site manifest discovery
        │   ├── siteHealthScan/        ← Automated site health scanning
        │   ├── vulnerabilityScanner/  ← Security vulnerability scanning
        │   ├── auditManager/          ← Site change detection & audit logging
        │   ├── sendNotification/     ← Notification dispatch (Slack, Discord, email, webhook)
        │   ├── manageStaging/         ← Staged fix preview management
        │   ├── sitePing/              ← Site connectivity ping
        │   ├── stripeCheckout/        ← Stripe checkout session creation
        │   └── stripeWebhook/         ← Stripe webhook handler
        └── agents/                    ← AI agent configs (if any)
```

---

## Database Schema Overview

| Entity | Purpose | Key Fields |
|--------|---------|------------|
| **Domain** | Registered WordPress sites | domain_name, domain_fingerprint, api_key, subscription_tier, fix_count_used/limit, wp_version, php_version, active_theme, active_plugins, stripe_customer_id |
| **FixExecution** | Individual fix records | domain_id, fix_description, fix_category, json_instruction, before_state, after_state, status, verification_status, verification_plan, verification_result, change_types_used, builder_type, setup_fingerprint |
| **FixRecipe** | Verified fix templates (learning KB) | title, category, fix_template, builder_type, theme_name, success_count, failure_count, effective_approach, failed_approaches, setup_tags |
| **PluginCapability** | Plugin knowledge base | plugin_slug, capability_type (rest_endpoint/option_key/hook/shortcode/etc), identifier, native_properties, fix_guidance, confidence_score, source_type |
| **SiteSetupProfile** | Site setup fingerprints | domain_id, setup_fingerprint, builder_type, theme_name, active_plugins, css_class_patterns, nav_structure, fixes_attempted/successful/failed, failed_approaches, effective_approaches |
| **ChatSession** | Chat conversations | domain_id, domain_name, user_email, status, title |
| **ChatMessage** | Chat messages | session_id, role (user/assistant/system), content, fix_proposal, fix_status |
| **SiteHealthScan** | Health scan results | domain_id, scan_date, status, progress, current_step, issues (JSON), total_issues |
| **VulnerabilityScan** | Security scans | domain_id, scan_date, status, vulnerabilities_found, vulnerabilities (JSON), wp_version, active_plugins |
| **SiteAudit** | Change audit trail | domain_id, change_type, description, diff_details, detected_by, severity |
| **StagedFix** | Staged fix previews | domain_id, fix_execution_id, staging_url, preview_token, status, verification_result |
| **NotificationChannel** | Notification config | domain_id, channel_type (slack/discord/email/webhook), webhook_url, events |

---

## Key Architecture Concepts

### Fix Flow
1. User sends a request via the WordPress chat panel or cloud dashboard
2. `aiFixOrchestrator` (backend function) receives the request with site context
3. It classifies the request (elementor_visual, woocommerce, forms, troubleshooting, etc.)
4. Fetches relevant context: Elementor widget map, WooCommerce data, plugin capabilities, past fixes, verified recipes
5. Invokes LLM (Gemini with web search) to generate a fix proposal with specific change types
6. User confirms the fix in the chat UI
7. Fix is applied via the WordPress plugin's REST API (`/wp-json/fixpilot/v1/apply`)
8. Automated verification runs (screenshot compare, DB state check, CSS/content presence, REST API verify)
9. Results are stored and used for future recipe learning

### Change Types (executed by the plugin)
- **post_meta_update** — Surgical Elementor widget property changes (using widget ID from map)
- **post_content_patch** — Search-and-replace text in post content or _elementor_data
- **generic_option_update** — Update wp_options values
- **css_inject** — Inject custom CSS (last resort, requires justification)
- **woocommerce_product_update** — Bulk product price/sale changes
- **post_update** — Full post content replacement
- **menu_update** — Navigation menu label changes
- **rest_api_call** — Execute arbitrary REST API calls on the site

### Plugin Auto-Update
The plugin checks `pluginUpdateCheck` function for new versions. When a newer version exists, WordPress shows a native "Update available" notification and can auto-update by downloading the ZIP from the function's GET endpoint.

---

## Known Issues & Context for AI Agents

1. **Elementor patching** — Must use structured tree-walk (decode JSON → modify fields → re-encode). Raw string search-and-replace corrupts the JSON structure.
2. **CSS caching** — WordPress sites aggressively cache CSS. Verification often shows false-negatives because the cached version hasn't refreshed. DB state checks bypass this.
3. **Plugin knowledge ingestion** — Large plugin stacks take time to research. Priority queue: Known → New → Rare/Custom.
4. **Builder detection** — The orchestrator detects the page builder (Elementor, Divi, Beaver, Gutenberg, etc.) and chooses appropriate change types.
5. **Native-only policy** — CSS injection is forbidden by default. The orchestrator must exhaust native pathways (post_meta_update, generic_option_update, etc.) first.
6. **Verification** — screenshot_compare is mandatory for all visual/content/WooCommerce fixes.

---

## Setup Instructions

### WordPress Plugin
1. Zip the contents of `wordpress-plugin/` (the folder should be named `fixpilot`)
2. Upload via WordPress admin → Plugins → Add New → Upload Plugin
3. Activate the plugin
4. The plugin auto-registers with the cloud app on first admin page load

### Cloud App (Base44)
This app is built on the Base44 platform. To deploy:
1. The `cloud-app/` directory contains the full source
2. Backend functions are Deno Deploy handlers in `base44/functions/`
3. Entity schemas in `base44/entities/` define the database structure
4. The React frontend in `src/` runs on Vite
5. Environment variables needed: STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY (for billing)
