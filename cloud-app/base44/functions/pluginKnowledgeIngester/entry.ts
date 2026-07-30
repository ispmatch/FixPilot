import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── Knowledge targets: plugins we know how to ingest comprehensively ───
const KNOWLEDGE_TARGETS = {
  woocommerce: {
    name: 'WooCommerce',
    ingest_prompt: `You are a knowledge ingestion engine for FixPilot, a WordPress AI fix assistant. Research the WooCommerce plugin's REST API, option keys, and hooks by searching the official WooCommerce developer documentation (developer.woocommerce.com and woocommerce.com/document/woocommerce-rest-api/).

Extract a COMPREHENSIVE set of capabilities that FixPilot can use to programmatically fix WooCommerce stores. For EACH capability, classify it as one of:
- rest_endpoint: a WooCommerce REST API route (e.g. /wc/store/v1/products, /wc/v3/orders/{id})
- option_key: a wp_options key WooCommerce uses (e.g. woocommerce_currency, woocommerce_default_country, woocommerce_shop_page_display)
- hook: an action/filter hook useful for code fixes (e.g. woocommerce_product_query, woocommerce_get_price_html)
- shortcode: a WooCommerce shortcode (e.g. [products], [woocommerce_cart])
- database_table: a WooCommerce custom table (e.g. wp_woocommerce_order_items)

For the REST endpoints, focus on the Store API (public, no auth needed for reads) and the WC API v3 (admin, needs auth). Include product, order, cart, checkout, customer, and settings endpoints.

Be thorough — return at least 40 capabilities covering the most common fix scenarios: pricing, stock, shipping, checkout, product display, tax, emails, and currency.

Set "version_tested" to the WooCommerce version this capability requires (e.g. "8.0+" or "7.2-8.x"), or "" if it applies to all versions.

CRITICAL: Respond with ONLY a valid JSON object (no markdown, no code fences). Use this exact structure:
{"capabilities":[{"capability_type":"rest_endpoint","identifier":"/wc/store/v1/products","method":"GET","description":"List products","required_params":"[]","example_usage":"{\"per_page\":20,\"category\":\"mugs\"}","fix_guidance":"Use rest_api_call with GET to read products. Use /wc/store/v1/products/{id} for a single product.","confidence_score":1.0,"version_tested":"","source_url":"https://developer.woocommerce.com/docs/..."}]}`
  },
  'contact-form-7': {
    name: 'Contact Form 7',
    ingest_prompt: `You are a knowledge ingestion engine for FixPilot, a WordPress AI fix assistant. Research the Contact Form 7 plugin by searching contactform7.com and the WordPress.org plugin docs.

Extract capabilities FixPilot can use to programmatically fix Contact Form 7 forms. For EACH capability:
- option_key: wp_options keys CF7 uses (e.g. wpcf7, wpcf7_recaptcha, wpcf7_constant_contact)
- rest_endpoint: any CF7 REST API routes (e.g. /wp/v2/wpcf7_contact_form, /contact-form-7/v1/contact-forms)
- hook: CF7 actions/filters (e.g. wpcf7_mail_sent, wpcf7_before_send_mail, wpcf7_form_elements)
- shortcode: CF7 shortcodes (e.g. [contact-form-7], [submit])
- database_table: CF7 custom tables (e.g. wp_contact_form_7_posts is NOT used — forms are a custom post type)

CRITICAL KNOWLEDGE: Contact Form 7 stores each form as a custom post type "wpcf7_contact_form". The form's fields, labels, and mail configuration are stored in the post_content of that post as mail-tag shortcodes. For example a text field with label "Organisation Name" looks like: [text* organisation-name "Organisation Name"]. To change a field LABEL, you edit the form body (post_content) and change the text inside the quotes. The post can be read/updated via /wp/v2/wpcf7_contact_form REST endpoint (needs auth) or by post_update with the form's post ID.

Return at least 20 capabilities. Mark official-doc items confidence 1.0.

Set "version_tested" to the CF7 version this capability requires (e.g. "5.7+"), or "" if it applies to all versions.
CRITICAL: Respond with ONLY a valid JSON object (no markdown). Use: {"capabilities":[{"capability_type":"rest_endpoint","identifier":"/wp/v2/wpcf7_contact_form","method":"GET","description":"List all Contact Form 7 forms","required_params":"[]","example_usage":"{}","fix_guidance":"Use to find form IDs and titles before editing a specific form.","confidence_score":1.0,"version_tested":"","source_url":"https://contactform7.com/..."}]}`
  },
  elementor: {
    name: 'Elementor',
    ingest_prompt: `You are a knowledge ingestion engine for FixPilot, a WordPress AI fix assistant. Research the Elementor page builder plugin by searching developers.elementor.com and elementor.com/help.

Extract capabilities FixPilot can use to programmatically fix Elementor-built sites. For EACH capability:
- option_key: wp_options keys Elementor uses (e.g. elementor_active_kit_id, elementor_scheme_color, elementor_scheme_typography, elementor_container_width, _elementor_settings post meta)
- rest_endpoint: any Elementor REST API routes
- hook: Elementor filters/actions for code fixes (e.g. elementor/frontend/after_enqueue_styles, elementor/widget/render_content)
- class_method: useful Elementor classes (e.g. Elementor\\Core\\Kits\\Manager, Elementor\Plugin::$instance->kits_manager)

Focus on global site settings (colors, typography, containers), page-level meta, and widget rendering. Return at least 30 capabilities.

Set "version_tested" to the Elementor version this capability requires (e.g. "3.5+"), or "" if it applies to all versions.

CRITICAL: Respond with ONLY a valid JSON object (no markdown). Use: {"capabilities":[{"capability_type":"option_key","identifier":"elementor_active_kit_id","method":"","description":"Active Kit ID for global colors/typography","required_params":"[]","example_usage":"{\"value\":123}","fix_guidance":"Use generic_option_update to change the active kit. Read current with option_value.","confidence_score":1.0,"version_tested":"","source_url":"..."}]}`
  },
};

function normalizePluginSlug(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function slugFromPlugins(activePlugins) {
  const seen = new Set();
  const out = [];
  for (const p of activePlugins || []) {
    const raw = typeof p === 'string' ? p : (p.path || p.slug || p.name || '');
    // WordPress plugin paths look like "woocommerce/woocommerce.php" — take the dir.
    // Names (e.g. "Contact Form 7") are normalised to the hyphenated slug form.
    // Strip non-alphanumeric chars (except space and hyphen) to handle display names
    // with special chars like "Akismet Anti-spam: Spam Protection" → "akismet-anti-spam-spam-protection"
    const dir = raw.split('/')[0].trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
    if (dir && !seen.has(dir)) {
      seen.add(dir);
      out.push({ slug: dir, name: typeof p === 'object' ? (p.name || dir) : dir });
    }
  }
  return out;
}

// Map common plugin slugs to display names for fuzzy matching
const SLUG_TO_NAME = {
  'woocommerce': 'WooCommerce',
  'elementor': 'Elementor',
  'contact-form-7': 'Contact Form 7',
  'yoast-seo': 'Yoast SEO',
  'wordpress-seo': 'Yoast SEO',
  'jetpack': 'Jetpack',
  'wpforms-lite': 'WPForms',
  'wpforms': 'WPForms',
  'akismet': 'Akismet',
  'litespeed-cache': 'LiteSpeed Cache',
  'wp-super-cache': 'WP Super Cache',
  'wordfence': 'Wordfence Security',
  'divi-builder': 'Divi',
  'beaver-builder-lite-version': 'Beaver Builder',
  'brizy': 'Brizy',
  'siteorigin-panels': 'SiteOrigin Page Builder',
};

// ─── Structural Category Detection (mirrors siteStackDiscovery) ───
// Tags each PluginCapability with one of the 9 structural stack categories.
const SLUG_TO_CATEGORY = {
  'elementor': 'builder', 'divi-builder': 'builder', 'beaver-builder-lite-version': 'builder', 'bb-plugin': 'builder', 'brizy': 'builder', 'siteorigin-panels': 'builder', 'thrive-visual-editor': 'builder', 'thrive-architect': 'builder',
  'woocommerce': 'ecommerce', 'easy-digital-downloads': 'ecommerce', 'wp-easycart': 'ecommerce',
  'contact-form-7': 'forms', 'wpforms': 'forms', 'wpforms-lite': 'forms', 'gravityforms': 'forms', 'ninja-forms': 'forms', 'formidable': 'forms', 'formidable-forms': 'forms',
  'wordpress-seo': 'seo', 'yoast-seo': 'seo', 'wp-seo': 'seo', 'seo-by-rank-math': 'seo', 'rank-math': 'seo', 'all-in-one-seo-pack': 'seo', 'all-in-one-seo': 'seo', 'seopress': 'seo', 'autodescription': 'seo',
  'advanced-custom-fields': 'custom_data', 'acf': 'custom_data', 'advanced-custom-fields-pro': 'custom_data', 'custom-post-type-ui': 'custom_data', 'jet-engine': 'custom_data', 'pods': 'custom_data', 'meta-box': 'custom_data',
  // Security & Identity
  'wordfence': 'security', 'wordfence-login-security': 'security', 'better-wp-security': 'security', 'ithemes-security': 'security', 'all-in-one-wp-security-and-firewall': 'security', 'sucuri-scanner': 'security', 'limit-login-attempts-reloaded': 'security', 'limit-login-attempts': 'security', 'two-factor': 'security', 'wp-2fa': 'security', 'members': 'security', 'user-role-editor': 'security', 'capability-manager-enhanced': 'security', 'wp-hide-security-enhancer': 'security',
  // Performance & Caching
  'litespeed-cache': 'performance', 'wp-super-cache': 'performance', 'wp-rocket': 'performance', 'w3-total-cache': 'performance', 'wp-fastest-cache': 'performance', 'cache-enabler': 'performance', 'redis-cache': 'performance', 'wp-redis': 'performance', 'autoptimize': 'performance', 'cloudflare': 'performance', 'bunny-cdn': 'performance',
  // Communication & Events
  'wp-mail-smtp': 'communication', 'wp-smtp': 'communication', 'postman-smtp': 'communication', 'easy-wp-smtp': 'communication', 'fluent-smtp': 'communication', 'smtp-mailer': 'communication', 'bookly': 'communication', 'amelia-booking': 'communication', 'events-manager': 'communication', 'the-events-calendar': 'communication', 'event-tickets': 'communication', 'hubspot': 'communication', 'mailchimp-for-wp': 'communication', 'mailchimp': 'communication',
  // Content & Media Operations
  'wp-smush': 'media', 'smush': 'media', 'wp-smushit': 'media', 'imagify': 'media', 'shortpixel-image-optimiser': 'media', 'shortpixel-adaptive-images': 'media', 'tinymce-advanced': 'media', 'classic-editor': 'media', 'enable-media-replace': 'media', 'regenerate-thumbnails': 'media', 'media-library-assistant': 'media',
};

function detectCategoryFromSlug(slug) {
  const s = (slug || '').toLowerCase();
  if (SLUG_TO_CATEGORY[s]) return SLUG_TO_CATEGORY[s];
  if (s.includes('elementor') || s.includes('divi') || s.includes('beaver') || s.includes('brizy') || s.includes('siteorigin') || s.includes('thrive')) return 'builder';
  if (s.includes('woocommerce')) return 'ecommerce';
  if (s.includes('wpforms') || s.includes('contact-form') || s.includes('gravity') || s.includes('ninja-form') || s.includes('formidable')) return 'forms';
  if (s.includes('yoast') || s.includes('wordpress-seo') || s.includes('rank-math') || s.includes('seo') || s.includes('seopress')) return 'seo';
  if (s.includes('acf') || s.includes('custom-field') || s.includes('custom-post-type') || s.includes('jet-engine') || s.includes('pods') || s.includes('meta-box')) return 'custom_data';
  // Security & Identity
  if (s.includes('wordfence') || s.includes('sucuri') || s.includes('ithemes') || s.includes('wp-security') || s.includes('limit-login') || s.includes('two-factor') || s.includes('2fa') || s.includes('user-role') || s.includes('capability-manager') || s.includes('wp-hide')) return 'security';
  if (s.includes('members')) return 'security';
  // Performance & Caching
  if (s.includes('litespeed') || s.includes('super-cache') || s.includes('supercache') || s.includes('wp-rocket') || s.includes('w3-total') || s.includes('fastest-cache') || s.includes('cache-enabler') || s.includes('redis') || s.includes('autoptimize') || s.includes('cloudflare') || s.includes('bunny')) return 'performance';
  if (s.includes('cache')) return 'performance';
  // Communication & Events
  if (s.includes('smtp') || s.includes('bookly') || s.includes('booking') || s.includes('amelia') || s.includes('events') || s.includes('event-tickets') || s.includes('hubspot') || s.includes('mailchimp')) return 'communication';
  // Content & Media Operations
  if (s.includes('smush') || s.includes('imagify') || s.includes('shortpixel') || s.includes('tinymce') || s.includes('classic-editor') || s.includes('media-replace') || s.includes('regenerate-thumbnails') || s.includes('media-library')) return 'media';
  return 'general';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Ingestion actions run as the service role so they work BOTH when triggered
    // by an admin from the dashboard AND when fired in the background by the
    // orchestrator (on plugin activation / first chat). They only write to the
    // shared PluginCapability knowledge base — no per-user data is exposed.
    const body = await req.json();
    const { action } = body;

    // ─── ACTION: ingest a known plugin's documentation (e.g. woocommerce) ───
    if (action === 'ingest_plugin') {
      const { plugin_slug } = body;
      const target = KNOWLEDGE_TARGETS[plugin_slug];
      if (!target) {
        return Response.json({ error: `No ingestion target defined for "${plugin_slug}". Available: ${Object.keys(KNOWLEDGE_TARGETS).join(', ')}` }, { status: 400 });
      }

      const llmRaw = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: target.ingest_prompt,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: {
            capabilities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  capability_type: { type: 'string' },
                  identifier: { type: 'string' },
                  method: { type: 'string' },
                  description: { type: 'string' },
                  required_params: { type: 'string' },
                  example_usage: { type: 'string' },
                  fix_guidance: { type: 'string' },
                  confidence_score: { type: 'number' },
                  source_url: { type: 'string' },
                  version_tested: { type: 'string' },
                },
              },
            },
          },
        },
      });

      let parsed;
      try {
        const cleaned = typeof llmRaw === 'string'
          ? llmRaw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
          : llmRaw;
        parsed = typeof cleaned === 'string' ? JSON.parse(cleaned) : cleaned;
      } catch (e) {
        return Response.json({ error: 'Failed to parse LLM capability response: ' + e.message, raw: typeof llmRaw === 'string' ? llmRaw.substring(0, 500) : 'object' }, { status: 500 });
      }

      const capabilities = parsed.capabilities || [];
      if (!capabilities.length) {
        return Response.json({ error: 'LLM returned no capabilities' }, { status: 500 });
      }

      // Fetch existing capability identifiers for this plugin to dedupe
      const existing = await base44.asServiceRole.entities.PluginCapability.filter({ plugin_slug }, 'created_date', 500);
      const existingKeys = new Set(existing.map(c => `${c.capability_type}|${c.identifier}|${c.method || ''}`));

      const toCreate = [];
      let updatedCount = 0;
      for (const cap of capabilities) {
        if (!cap.identifier || !cap.capability_type) continue;
        const key = `${cap.capability_type}|${cap.identifier}|${cap.method || ''}`;
        if (existingKeys.has(key)) { updatedCount++; continue; }
        toCreate.push({
          plugin_slug,
          structural_category: detectCategoryFromSlug(plugin_slug),
          plugin_name: target.name,
          capability_type: cap.capability_type,
          identifier: cap.identifier,
          method: cap.method || '',
          description: cap.description || '',
          required_params: cap.required_params || '[]',
          example_usage: cap.example_usage || '',
          fix_guidance: cap.fix_guidance || '',
          confidence_score: cap.confidence_score || 0.7,
          source_url: cap.source_url || '',
          version_tested: cap.version_tested || '',
          source_type: 'official_docs',
          knowledge_depth: 'comprehensive',
          last_ingested: new Date().toISOString(),
        });
      }

      let created = [];
      if (toCreate.length) {
        created = await base44.asServiceRole.entities.PluginCapability.bulkCreate(toCreate);
      }

      return Response.json({
        success: true,
        plugin_slug,
        plugin_name: target.name,
        total_returned: capabilities.length,
        new_records: Array.isArray(created) ? created.length : 0,
        duplicates_skipped: updatedCount,
      });
    }

    // ─── ACTION: generic research for an unknown plugin (forum/doc synthesis) ───
    if (action === 'research_unknown_plugin') {
      const { plugin_slug, plugin_name } = body;
      if (!plugin_slug) return Response.json({ error: 'plugin_slug is required' }, { status: 400 });

      // ─── Global cache check: skip LLM entirely if already mapped (scales to 100k+ sites) ───
      const existing = await base44.asServiceRole.entities.PluginCapability.filter({ plugin_slug }, 'created_date', 500);
      const isKnownTarget = !!KNOWLEDGE_TARGETS[plugin_slug];
      if (isKnownTarget ? existing.length >= 20 : existing.length >= 5) {
        return Response.json({ success: true, plugin_slug, status: 'already_mapped', capability_count: existing.length });
      }

      const displayName = plugin_name || SLUG_TO_NAME[plugin_slug] || plugin_slug;

      const researchPrompt = `You are a knowledge ingestion engine for FixPilot, a WordPress AI fix assistant. We have detected a plugin "${displayName}" (slug: ${plugin_slug}) on a client's WordPress site that we have little or no knowledge of.

Research this plugin by searching the web (WordPress.org plugin page, official docs, vendor site, and reputable WP tutorial sites). Find out how FixPilot can programmatically interact with it to fix issues.

Extract capabilities FixPilot can use. For EACH capability, classify as:
- rest_endpoint: any REST API route the plugin registers (search /wp-json/)
- option_key: wp_options keys the plugin uses to store settings
- hook: actions/filters the plugin exposes
- shortcode: shortcodes the plugin provides
- general_doc: a general knowledge note (for forum-sourced info we can't classify precisely)

Be pragmatic: even partial knowledge is useful — mark uncertain items with confidence_score 0.5 and source_type "forum_post" or "vendor_blog". Official docs get 1.0 and "official_docs".

Return at least 15 capabilities (or as many as genuinely exist). Focus on the settings/options the plugin stores and any REST API it exposes — these are what FixPilot uses for generic_option_update and rest_api_call fixes.

Set "version_tested" to the plugin version this capability was verified against (e.g. "8.0+"), or "" if it applies to all versions.

CRITICAL: Respond with ONLY a valid JSON object (no markdown). Use: {"capabilities":[{"capability_type":"option_key","identifier":"the_option_key","method":"","description":"...","required_params":"[]","example_usage":"...","fix_guidance":"...","confidence_score":0.7,"version_tested":"","source_url":"..."}]}`;

      const llmRaw = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: researchPrompt,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: {
            capabilities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  capability_type: { type: 'string' },
                  identifier: { type: 'string' },
                  method: { type: 'string' },
                  description: { type: 'string' },
                  required_params: { type: 'string' },
                  example_usage: { type: 'string' },
                  fix_guidance: { type: 'string' },
                  confidence_score: { type: 'number' },
                  source_url: { type: 'string' },
                  version_tested: { type: 'string' },
                },
              },
            },
          },
        },
      });

      let parsed;
      try {
        const cleaned = typeof llmRaw === 'string'
          ? llmRaw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
          : llmRaw;
        parsed = typeof cleaned === 'string' ? JSON.parse(cleaned) : cleaned;
      } catch (e) {
        return Response.json({ error: 'Failed to parse research response: ' + e.message }, { status: 500 });
      }

      const capabilities = parsed.capabilities || [];
      const existingKeys = new Set(existing.map(c => `${c.capability_type}|${c.identifier}|${c.method || ''}`));

      const toCreate = [];
      for (const cap of capabilities) {
        if (!cap.identifier || !cap.capability_type) continue;
        const key = `${cap.capability_type}|${cap.identifier}|${cap.method || ''}`;
        if (existingKeys.has(key)) continue;
        const score = typeof cap.confidence_score === 'number' ? cap.confidence_score : 0.6;
        toCreate.push({
          plugin_slug,
          structural_category: detectCategoryFromSlug(plugin_slug),
          plugin_name: displayName,
          capability_type: cap.capability_type,
          identifier: cap.identifier,
          method: cap.method || '',
          description: cap.description || '',
          required_params: cap.required_params || '[]',
          example_usage: cap.example_usage || '',
          fix_guidance: cap.fix_guidance || '',
          confidence_score: score,
          source_url: cap.source_url || '',
          version_tested: cap.version_tested || '',
          source_type: score >= 0.9 ? 'official_docs' : 'forum_post',
          knowledge_depth: 'partial',
          last_ingested: new Date().toISOString(),
        });
      }

      let created = [];
      if (toCreate.length) {
        created = await base44.asServiceRole.entities.PluginCapability.bulkCreate(toCreate);
      }

      // Mark as having at least partial knowledge now
      return Response.json({
        success: true,
        plugin_slug,
        plugin_name: displayName,
        total_returned: capabilities.length,
        new_records: Array.isArray(created) ? created.length : 0,
        knowledge_depth: 'partial',
      });
    }

    // ─── ACTION: check which plugins on a site we have little knowledge of ───
    if (action === 'audit_knowledge') {
      const { active_plugins } = body;
      const detected = slugFromPlugins(active_plugins);

      const report = [];
      for (const { slug, name } of detected) {
        const existing = await base44.asServiceRole.entities.PluginCapability.filter({ plugin_slug: slug }, 'created_date', 500);
        const count = existing.length;
        report.push({
          slug,
          name,
          known: count > 0,
          capability_count: count,
          needs_research: count < 5,
          has_comprehensive: existing.some(c => c.knowledge_depth === 'comprehensive'),
        });
      }

      const unknown = report.filter(r => r.needs_research);
      return Response.json({ success: true, total_plugins: detected.length, known: report.filter(r => r.known).length, unknown: unknown.map(r => r.slug), report });
    }

    // ─── ACTION: process next batch of unmapped plugins across ALL domains (scheduled) ───
    if (action === 'process_next_unmapped') {
      // 1. Collect all unique plugin slugs across all registered domains
      const allDomains = await base44.asServiceRole.entities.Domain.list('-created_date', 100);
      const slugToPlugins = {}; // slug → { slug, name, domains: [] }
      for (const d of allDomains) {
        let plugins = [];
        try { plugins = JSON.parse(d.active_plugins || '[]'); } catch {}
        const detected = slugFromPlugins(plugins);
        for (const p of detected) {
          if (p.slug === 'fixpilot') continue;
          if (!slugToPlugins[p.slug]) slugToPlugins[p.slug] = { slug: p.slug, name: p.name };
        }
      }
      const allSlugs = Object.values(slugToPlugins);

      // 2. Bulk-check which are unmapped
      const allCaps = await base44.asServiceRole.entities.PluginCapability.filter({}, 'created_date', 1000);
      const capsBySlug = {};
      for (const c of allCaps) { if (c.plugin_slug) capsBySlug[c.plugin_slug] = (capsBySlug[c.plugin_slug] || 0) + 1; }
      const unmapped = allSlugs.filter(p => {
        const isKnown = !!KNOWLEDGE_TARGETS[p.slug];
        const count = capsBySlug[p.slug] || 0;
        return isKnown ? count < 20 : count < 5;
      });

      if (!unmapped.length) {
        return Response.json({ success: true, message: 'All plugins across all domains are mapped', total_slugs: allSlugs.length, unmapped: 0 });
      }

      // 3. Process next batch of 10
      const BATCH_SIZE = 6;
      const MAX_PER_CALL = 10;
      const toProcessNow = unmapped.slice(0, MAX_PER_CALL);
      const report = [];

      async function processPluginUnmapped(p) {
        const existing = await base44.asServiceRole.entities.PluginCapability.filter({ plugin_slug: p.slug }, 'created_date', 500);
        const count = existing.length;
        const isKnown = !!KNOWLEDGE_TARGETS[p.slug];
        const needsWork = isKnown ? count < 20 : count < 5;
        if (!needsWork) return { slug: p.slug, status: 'already_known', count };
        try {
          const displayName = p.name || SLUG_TO_NAME[p.slug] || p.slug;
          const researchPrompt = `You are a knowledge ingestion engine for FixPilot, a WordPress AI fix assistant. We detected a plugin "${displayName}" (slug: ${p.slug}) on a client's WordPress site. Research it via the web (WordPress.org, official docs, vendor site). Extract capabilities FixPilot can use: rest_endpoint, option_key, hook, shortcode, general_doc. Mark uncertain items confidence 0.5 / source_type "forum_post"; official docs 1.0 / "official_docs". Return at least 12 capabilities focusing on wp_options keys and REST API routes. Set "version_tested" to the plugin version (e.g. "8.0+") or "" if universal. Respond with ONLY JSON: {"capabilities":[{"capability_type":"option_key","identifier":"...","method":"","description":"...","required_params":"[]","example_usage":"...","fix_guidance":"...","confidence_score":0.7,"version_tested":"","source_url":"..."}]}`;
          const llmRaw = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: researchPrompt,
            add_context_from_internet: true,
            model: 'gemini_3_flash',
            response_json_schema: { type: "object", properties: { capabilities: { type: "array", items: { type: "object", properties: { capability_type: { type: "string" }, identifier: { type: "string" }, method: { type: "string" }, description: { type: "string" }, required_params: { type: "string" }, example_usage: { type: "string" }, fix_guidance: { type: "string" }, confidence_score: { type: "number" }, source_url: { type: "string" }, version_tested: { type: "string" } } } } } },
          });
          let parsed;
          try { const cleaned = typeof llmRaw === 'string' ? llmRaw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim() : llmRaw; parsed = typeof cleaned === 'string' ? JSON.parse(cleaned) : cleaned; } catch (e) { return { slug: p.slug, status: 'parse_error' }; }
          const caps = (parsed.capabilities || []).filter(c => c.identifier && c.capability_type);
          const existingKeys = new Set(existing.map(c => `${c.capability_type}|${c.identifier}|${c.method || ''}`));
          const toCreate = [];
          for (const cap of caps) { if (existingKeys.has(`${cap.capability_type}|${cap.identifier}|${cap.method || ''}`)) continue; const score = typeof cap.confidence_score === 'number' ? cap.confidence_score : 0.6; toCreate.push({ plugin_slug: p.slug, structural_category: detectCategoryFromSlug(p.slug), plugin_name: displayName, capability_type: cap.capability_type, identifier: cap.identifier, method: cap.method || '', description: cap.description || '', required_params: cap.required_params || '[]', example_usage: cap.example_usage || '', fix_guidance: cap.fix_guidance || '', confidence_score: score, source_url: cap.source_url || '', version_tested: cap.version_tested || '', source_type: score >= 0.9 ? 'official_docs' : 'forum_post', knowledge_depth: 'partial', last_ingested: new Date().toISOString() }); }
          if (toCreate.length) await base44.asServiceRole.entities.PluginCapability.bulkCreate(toCreate);
          return { slug: p.slug, status: 'researched', new_records: toCreate.length };
        } catch (e) { return { slug: p.slug, status: 'error', error: e.message }; }
      }

      for (let i = 0; i < toProcessNow.length; i += BATCH_SIZE) {
        const batch = toProcessNow.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(batch.map(processPluginUnmapped));
        for (const r of results) { if (r.status === 'fulfilled') report.push(r.value); else report.push({ status: 'error', error: r.reason?.message || 'unknown' }); }
      }

      return Response.json({
        success: true,
        action: 'process_next_unmapped',
        total_slugs: allSlugs.length,
        unmapped: unmapped.length,
        processed: toProcessNow.length,
        remaining: unmapped.length - toProcessNow.length,
        report,
      });
    }

    // ─── ACTION: ingest knowledge for EVERY plugin on a site (triggered on activation) ───
    if (action === 'ingest_site_plugins') {
      const { active_plugins, active_theme } = body;
      const detected = slugFromPlugins(active_plugins);
      const knownSlugs = Object.keys(KNOWLEDGE_TARGETS);
      const BATCH_SIZE = 6;
      const report = [];

      async function processPlugin(p) {
        const existing = await base44.asServiceRole.entities.PluginCapability.filter({ plugin_slug: p.slug }, 'created_date', 500);
        const count = existing.length;
        const isKnown = !!KNOWLEDGE_TARGETS[p.slug];
        const needsWork = isKnown ? count < 20 : count < 5;
        if (!needsWork) return { slug: p.slug, status: 'already_known', count };
        try {
          if (isKnown) {
            const target = KNOWLEDGE_TARGETS[p.slug];
            const llmRaw = await base44.asServiceRole.integrations.Core.InvokeLLM({
              prompt: target.ingest_prompt,
              add_context_from_internet: true,
              model: 'gemini_3_flash',
              response_json_schema: { type: "object", properties: { capabilities: { type: "array", items: { type: "object", properties: { capability_type: { type: "string" }, identifier: { type: "string" }, method: { type: "string" }, description: { type: "string" }, required_params: { type: "string" }, example_usage: { type: "string" }, fix_guidance: { type: "string" }, confidence_score: { type: "number" }, source_url: { type: "string" }, version_tested: { type: "string" } } } } } },
            });
            let parsed;
            try { const cleaned = typeof llmRaw === 'string' ? llmRaw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim() : llmRaw; parsed = typeof cleaned === 'string' ? JSON.parse(cleaned) : cleaned; } catch (e) { return { slug: p.slug, status: 'parse_error' }; }
            const caps = (parsed.capabilities || []).filter(c => c.identifier && c.capability_type);
            const existingKeys = new Set(existing.map(c => `${c.capability_type}|${c.identifier}|${c.method || ''}`));
            const toCreate = [];
            for (const cap of caps) { if (existingKeys.has(`${cap.capability_type}|${cap.identifier}|${cap.method || ''}`)) continue; toCreate.push({ plugin_slug: p.slug, structural_category: detectCategoryFromSlug(p.slug), plugin_name: target.name, capability_type: cap.capability_type, identifier: cap.identifier, method: cap.method || '', description: cap.description || '', required_params: cap.required_params || '[]', example_usage: cap.example_usage || '', fix_guidance: cap.fix_guidance || '', confidence_score: cap.confidence_score || 0.7, source_url: cap.source_url || '', version_tested: cap.version_tested || '', source_type: 'official_docs', knowledge_depth: 'comprehensive', last_ingested: new Date().toISOString() }); }
            if (toCreate.length) await base44.asServiceRole.entities.PluginCapability.bulkCreate(toCreate);
            return { slug: p.slug, status: 'ingested_comprehensive', new_records: toCreate.length };
          } else {
            const displayName = p.name || SLUG_TO_NAME[p.slug] || p.slug;
            const researchPrompt = `You are a knowledge ingestion engine for FixPilot, a WordPress AI fix assistant. We detected a plugin "${displayName}" (slug: ${p.slug}) on a client's WordPress site. Research it via the web (WordPress.org, official docs, vendor site). Extract capabilities FixPilot can use: rest_endpoint, option_key, hook, shortcode, general_doc. Mark uncertain items confidence 0.5 / source_type "forum_post"; official docs 1.0 / "official_docs". Return at least 12 capabilities focusing on wp_options keys and REST API routes. Set "version_tested" to the plugin version (e.g. "8.0+") or "" if universal. Respond with ONLY JSON: {"capabilities":[{"capability_type":"option_key","identifier":"...","method":"","description":"...","required_params":"[]","example_usage":"...","fix_guidance":"...","confidence_score":0.7,"version_tested":"","source_url":"..."}]}`;
            const llmRaw = await base44.asServiceRole.integrations.Core.InvokeLLM({
              prompt: researchPrompt,
              add_context_from_internet: true,
              model: 'gemini_3_flash',
              response_json_schema: { type: "object", properties: { capabilities: { type: "array", items: { type: "object", properties: { capability_type: { type: "string" }, identifier: { type: "string" }, method: { type: "string" }, description: { type: "string" }, required_params: { type: "string" }, example_usage: { type: "string" }, fix_guidance: { type: "string" }, confidence_score: { type: "number" }, source_url: { type: "string" }, version_tested: { type: "string" } } } } } },
            });
            let parsed;
            try { const cleaned = typeof llmRaw === 'string' ? llmRaw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim() : llmRaw; parsed = typeof cleaned === 'string' ? JSON.parse(cleaned) : cleaned; } catch (e) { return { slug: p.slug, status: 'parse_error' }; }
            const caps = (parsed.capabilities || []).filter(c => c.identifier && c.capability_type);
            const existingKeys = new Set(existing.map(c => `${c.capability_type}|${c.identifier}|${c.method || ''}`));
            const toCreate = [];
            for (const cap of caps) { if (existingKeys.has(`${cap.capability_type}|${cap.identifier}|${cap.method || ''}`)) continue; const score = typeof cap.confidence_score === 'number' ? cap.confidence_score : 0.6; toCreate.push({ plugin_slug: p.slug, structural_category: detectCategoryFromSlug(p.slug), plugin_name: displayName, capability_type: cap.capability_type, identifier: cap.identifier, method: cap.method || '', description: cap.description || '', required_params: cap.required_params || '[]', example_usage: cap.example_usage || '', fix_guidance: cap.fix_guidance || '', confidence_score: score, source_url: cap.source_url || '', version_tested: cap.version_tested || '', source_type: score >= 0.9 ? 'official_docs' : 'forum_post', knowledge_depth: 'partial', last_ingested: new Date().toISOString() }); }
            if (toCreate.length) await base44.asServiceRole.entities.PluginCapability.bulkCreate(toCreate);
            return { slug: p.slug, status: 'researched', new_records: toCreate.length };
          }
        } catch (e) { return { slug: p.slug, status: 'error', error: e.message }; }
      }

      // Bulk-check which plugins still need research (avoids N individual queries)
      const allCaps = await base44.asServiceRole.entities.PluginCapability.filter({}, 'created_date', 1000);
      const capsBySlug = {};
      for (const c of allCaps) { if (c.plugin_slug) capsBySlug[c.plugin_slug] = (capsBySlug[c.plugin_slug] || 0) + 1; }
      const unmapped = detected.filter(p => {
        const isKnown = !!KNOWLEDGE_TARGETS[p.slug];
        const count = capsBySlug[p.slug] || 0;
        return isKnown ? count < 20 : count < 5;
      });
      // Process ALL unmapped in a single call — no cap, no unreliable self-chain.
      // The scheduled automation acts as a safety net if this call times out.
      const toProcessNow = unmapped;
      const hasMore = false;

      // Process this chunk in parallel groups of BATCH_SIZE
      for (let i = 0; i < toProcessNow.length; i += BATCH_SIZE) {
        const batch = toProcessNow.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(batch.map(processPlugin));
        for (const r of results) { if (r.status === 'fulfilled') report.push(r.value); else report.push({ status: 'error', error: r.reason?.message || 'unknown' }); }
      }

      // ─── Also ingest the active theme on the last batch (research vendor docs, hooks, options) ───
      if (active_theme && !hasMore) {
        const themeSlug = 'theme-' + active_theme.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const themeExisting = await base44.asServiceRole.entities.PluginCapability.filter({ plugin_slug: themeSlug }, 'created_date', 500);
        if (themeExisting.length < 10) {
          try {
            const themePrompt = `You are a knowledge ingestion engine for FixPilot, a WordPress AI fix assistant. Research the WordPress theme "${active_theme}" by searching the web — the theme's official website, WordPress.org theme directory, vendor documentation, and reputable WP tutorial sites.

Find out how FixPilot can programmatically interact with this theme to fix issues. Extract capabilities:
- option_key: wp_options keys the theme uses (e.g. theme_mods_<slug>, <theme>_options, customizer settings like <theme>_primary_color)
- hook: actions/filters the theme exposes (e.g. <theme>_header, <theme>_footer, <theme>_customizer_options)
- shortcode: shortcodes the theme provides
- general_doc: general knowledge notes about theme structure (template hierarchy, widget areas, custom post types, page templates)
- rest_endpoint: any REST API routes the theme registers

Focus on: how to change colors/typography via theme options or Customizer, how to modify header/footer layout, how to change menu styling, what template files exist, what widget areas are registered, and what customizer options are available. Mark official vendor docs confidence 1.0, forum/blog posts 0.5.

Return at least 15 capabilities. Set "version_tested" to the theme version (e.g. "1.1+") or "" if universal. Respond with ONLY JSON: {"capabilities":[{"capability_type":"option_key","identifier":"...","method":"","description":"...","required_params":"[]","example_usage":"...","fix_guidance":"...","confidence_score":0.8,"version_tested":"","source_url":"..."}]}`;
            const llmRaw = await base44.asServiceRole.integrations.Core.InvokeLLM({
              prompt: themePrompt,
              add_context_from_internet: true,
              model: 'gemini_3_flash',
              response_json_schema: { type: "object", properties: { capabilities: { type: "array", items: { type: "object", properties: { capability_type: { type: "string" }, identifier: { type: "string" }, method: { type: "string" }, description: { type: "string" }, required_params: { type: "string" }, example_usage: { type: "string" }, fix_guidance: { type: "string" }, confidence_score: { type: "number" }, source_url: { type: "string" }, version_tested: { type: "string" } } } } } },
            });
            let parsed;
            try { const cleaned = typeof llmRaw === 'string' ? llmRaw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim() : llmRaw; parsed = typeof cleaned === 'string' ? JSON.parse(cleaned) : cleaned; } catch (e) { report.push({ slug: themeSlug, status: 'theme_parse_error' }); parsed = null; }
            if (parsed) {
              const caps = (parsed.capabilities || []).filter(c => c.identifier && c.capability_type);
              const existingKeys = new Set(themeExisting.map(c => `${c.capability_type}|${c.identifier}|${c.method || ''}`));
              const toCreate = [];
              for (const cap of caps) { if (existingKeys.has(`${cap.capability_type}|${cap.identifier}|${cap.method || ''}`)) continue; toCreate.push({ plugin_slug: themeSlug, plugin_name: active_theme, structural_category: 'builder', capability_type: cap.capability_type, identifier: cap.identifier, method: cap.method || '', description: cap.description || '', required_params: cap.required_params || '[]', example_usage: cap.example_usage || '', fix_guidance: cap.fix_guidance || '', confidence_score: cap.confidence_score || 0.7, source_url: cap.source_url || '', version_tested: cap.version_tested || '', source_type: (cap.confidence_score || 0.7) >= 0.9 ? 'official_docs' : 'vendor_blog', knowledge_depth: 'partial', last_ingested: new Date().toISOString() }); }
              if (toCreate.length) await base44.asServiceRole.entities.PluginCapability.bulkCreate(toCreate);
              report.push({ slug: themeSlug, status: 'theme_ingested', new_records: toCreate.length });
            }
          } catch (e) { report.push({ slug: 'theme', status: 'theme_error', error: e.message }); }
        } else { report.push({ slug: themeSlug, status: 'theme_already_known', count: themeExisting.length }); }
      }

      // Self-chain: if more unmapped plugins remain, invoke again in the background for the next chunk
      if (hasMore) {
        base44.functions.invoke('pluginKnowledgeIngester', { action: 'ingest_site_plugins', active_plugins: active_plugins, active_theme: active_theme || '' }).catch(e => console.error('[ingest_site_plugins] Self-chain failed:', e.message));
      }
      return Response.json({ success: true, action: 'ingest_site_plugins', total_detected: detected.length, unmapped: unmapped.length, processed: toProcessNow.length, remaining: unmapped.length - toProcessNow.length, theme_processed: !!(active_theme && !hasMore), report });
    }

    return Response.json({ error: 'Invalid action. Use: ingest_plugin, ingest_site_plugins, research_unknown_plugin, or audit_knowledge.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});