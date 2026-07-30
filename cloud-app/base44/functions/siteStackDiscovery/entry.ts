import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ═══════════════════════════════════════════════════════════════════════════
// SITE STACK DISCOVERY — Proactive structural mapping of a site's key plugins.
//
// Architecture (platform-agnostic, Shopify-ready):
//   The 5 structural categories below are the same concepts regardless of
//   platform. WordPress detectors map plugin slugs → categories. When we
//   add Shopify, we add a SHOPIFY_PLUGIN_DETECTORS map with the same category
//   keys (builder = Online Store 2.0 theme, ecommerce = Shopify itself, etc.)
//   and the orchestrator's prompt injection stays identical.
// ═══════════════════════════════════════════════════════════════════════════

// ─── The 5 Top Structural Categories ───
const STACK_CATEGORIES = {
  builder: {
    id: 'builder',
    name: 'Page Builder / Site Editor',
    description: 'Defines page structure and visual layout. Native fix: post_meta_update on builder data.',
    native_fix_type: 'post_meta_update',
    priority: 1,
  },
  ecommerce: {
    id: 'ecommerce',
    name: 'E-commerce Engine',
    description: 'Manages products, orders, pricing. Native fix: rest_api_call to store API.',
    native_fix_type: 'rest_api_call',
    priority: 2,
  },
  forms: {
    id: 'forms',
    name: 'Form / Conversion Hub',
    description: 'Manages user input and form definitions. Native fix: post_update on form post.',
    native_fix_type: 'post_update',
    priority: 3,
  },
  seo: {
    id: 'seo',
    name: 'SEO & Schema Framework',
    description: 'Controls meta tags, sitemaps, structured data. Native fix: generic_option_update.',
    native_fix_type: 'generic_option_update',
    priority: 4,
  },
  custom_data: {
    id: 'custom_data',
    name: 'Custom Data / CPT Manager',
    description: 'Creates custom fields and post types. Native fix: post_meta_update on custom field key.',
    native_fix_type: 'post_meta_update',
    priority: 5,
  },
  security: {
    id: 'security',
    name: 'Security & Identity',
    description: 'Auth, user roles, 2FA, firewall, login protection. Native fix: generic_option_update on security option keys.',
    native_fix_type: 'generic_option_update',
    priority: 6,
  },
  performance: {
    id: 'performance',
    name: 'Performance & Caching',
    description: 'Page caching, CDN, object cache, asset optimization. Native fix: generic_option_update + cache purge hooks.',
    native_fix_type: 'generic_option_update',
    priority: 7,
  },
  communication: {
    id: 'communication',
    name: 'Communication & Events',
    description: 'SMTP/email delivery, bookings, calendars, CRM sync. Native fix: generic_option_update on SMTP/booking settings.',
    native_fix_type: 'generic_option_update',
    priority: 8,
  },
  media: {
    id: 'media',
    name: 'Content & Media Operations',
    description: 'Image optimization, media library, video/podcast managers, asset pipelines. Native fix: generic_option_update on media option keys.',
    native_fix_type: 'generic_option_update',
    priority: 9,
  },
};

// ─── WordPress Plugin Detectors ───
// Maps plugin directory slugs → structural category.
// When adding Shopify: create SHOPIFY_DETECTORS with same category structure.
const WP_PLUGIN_DETECTORS = {
  // Builder
  'elementor': { category: 'builder', name: 'Elementor', builder_key: 'elementor' },
  'divi-builder': { category: 'builder', name: 'Divi Builder', builder_key: 'divi' },
  'beaver-builder-lite-version': { category: 'builder', name: 'Beaver Builder', builder_key: 'beaver_builder' },
  'bb-plugin': { category: 'builder', name: 'Beaver Builder', builder_key: 'beaver_builder' },
  'brizy': { category: 'builder', name: 'Brizy', builder_key: 'brizy' },
  'siteorigin-panels': { category: 'builder', name: 'SiteOrigin Page Builder', builder_key: 'siteorigin' },
  'thrive-visual-editor': { category: 'builder', name: 'Thrive Architect', builder_key: 'thrust' },
  'thrive-architect': { category: 'builder', name: 'Thrive Architect', builder_key: 'thrust' },

  // E-commerce
  'woocommerce': { category: 'ecommerce', name: 'WooCommerce' },
  'easy-digital-downloads': { category: 'ecommerce', name: 'Easy Digital Downloads' },
  'wp-easycart': { category: 'ecommerce', name: 'WP EasyCart' },

  // Forms
  'contact-form-7': { category: 'forms', name: 'Contact Form 7' },
  'wpforms': { category: 'forms', name: 'WPForms' },
  'wpforms-lite': { category: 'forms', name: 'WPForms' },
  'gravityforms': { category: 'forms', name: 'Gravity Forms' },
  'ninja-forms': { category: 'forms', name: 'Ninja Forms' },
  'formidable': { category: 'forms', name: 'Formidable Forms' },
  'formidable-forms': { category: 'forms', name: 'Formidable Forms' },

  // SEO
  'wordpress-seo': { category: 'seo', name: 'Yoast SEO' },
  'yoast-seo': { category: 'seo', name: 'Yoast SEO' },
  'wp-seo': { category: 'seo', name: 'Yoast SEO' },
  'seo-by-rank-math': { category: 'seo', name: 'Rank Math' },
  'rank-math': { category: 'seo', name: 'Rank Math' },
  'all-in-one-seo-pack': { category: 'seo', name: 'All in One SEO' },
  'all-in-one-seo': { category: 'seo', name: 'All in One SEO' },
  'seopress': { category: 'seo', name: 'SEOPress' },
  'autodescription': { category: 'seo', name: 'The SEO Framework' },

  // Custom Data / CPT
  'advanced-custom-fields': { category: 'custom_data', name: 'ACF' },
  'acf': { category: 'custom_data', name: 'ACF' },
  'advanced-custom-fields-pro': { category: 'custom_data', name: 'ACF Pro' },
  'custom-post-type-ui': { category: 'custom_data', name: 'CPT UI' },
  'jet-engine': { category: 'custom_data', name: 'JetEngine' },
  'pods': { category: 'custom_data', name: 'Pods' },
  'meta-box': { category: 'custom_data', name: 'Meta Box' },
  'custom-field-suite': { category: 'custom_data', name: 'Custom Field Suite' },

  // Security & Identity
  'wordfence': { category: 'security', name: 'Wordfence Security' },
  'wordfence-login-security': { category: 'security', name: 'Wordfence Login Security' },
  'better-wp-security': { category: 'security', name: 'iThemes Security' },
  'ithemes-security': { category: 'security', name: 'iThemes Security' },
  'all-in-one-wp-security-and-firewall': { category: 'security', name: 'All In One WP Security' },
  'sucuri-scanner': { category: 'security', name: 'Sucuri Scanner' },
  'wp-sucuri': { category: 'security', name: 'Sucuri Security' },
  'limit-login-attempts-reloaded': { category: 'security', name: 'Limit Login Attempts Reloaded' },
  'limit-login-attempts': { category: 'security', name: 'Limit Login Attempts' },
  'two-factor': { category: 'security', name: 'Two Factor' },
  'wp-2fa': { category: 'security', name: 'WP 2FA' },
  'members': { category: 'security', name: 'Members' },
  'user-role-editor': { category: 'security', name: 'User Role Editor' },
  'capability-manager-enhanced': { category: 'security', name: 'Capability Manager Enhanced' },
  'wp-hide-security-enhancer': { category: 'security', name: 'WP Hide & Security Enhancer' },

  // Performance & Caching
  'litespeed-cache': { category: 'performance', name: 'LiteSpeed Cache' },
  'wp-super-cache': { category: 'performance', name: 'WP Super Cache' },
  'wp-rocket': { category: 'performance', name: 'WP Rocket' },
  'w3-total-cache': { category: 'performance', name: 'W3 Total Cache' },
  'w3-total-cache-deprecated': { category: 'performance', name: 'W3 Total Cache' },
  'wp-fastest-cache': { category: 'performance', name: 'WP Fastest Cache' },
  'cache-enabler': { category: 'performance', name: 'Cache Enabler' },
  'comet-cache': { category: 'performance', name: 'Comet Cache' },
  'wpc-advanced-cache': { category: 'performance', name: 'WPC Advanced Cache' },
  'redis-cache': { category: 'performance', name: 'Redis Object Cache' },
  'wp-redis': { category: 'performance', name: 'WP Redis' },
  'autoptimize': { category: 'performance', name: 'Autoptimize' },
  'cloudflare': { category: 'performance', name: 'Cloudflare' },
  'bunny-cdn': { category: 'performance', name: 'Bunny CDN' },

  // Communication & Events
  'wp-mail-smtp': { category: 'communication', name: 'WP Mail SMTP' },
  'wp-smtp': { category: 'communication', name: 'WP SMTP' },
  'postman-smtp': { category: 'communication', name: 'Postman SMTP' },
  'easy-wp-smtp': { category: 'communication', name: 'Easy WP SMTP' },
  'fluent-smtp': { category: 'communication', name: 'FluentSMTP' },
  'smtp-mailer': { category: 'communication', name: 'SMTP Mailer' },
  'bookly': { category: 'communication', name: 'Bookly' },
  'amelia-booking': { category: 'communication', name: 'Amelia' },
  'events-manager': { category: 'communication', name: 'Events Manager' },
  'the-events-calendar': { category: 'communication', name: 'The Events Calendar' },
  'event-tickets': { category: 'communication', name: 'Event Tickets' },
  'hubspot': { category: 'communication', name: 'HubSpot' },
  'mailchimp-for-wp': { category: 'communication', name: 'Mailchimp for WP' },
  'mailchimp': { category: 'communication', name: 'Mailchimp' },

  // Content & Media Operations
  'wp-smush': { category: 'media', name: 'Smush' },
  'smush': { category: 'media', name: 'Smush' },
  'wp-smushit': { category: 'media', name: 'Smush' },
  'imagify': { category: 'media', name: 'Imagify' },
  'shortpixel-image-optimiser': { category: 'media', name: 'ShortPixel' },
  'shortpixel-adaptive-images': { category: 'media', name: 'ShortPixel Adaptive' },
  'tinymce-advanced': { category: 'media', name: 'TinyMCE Advanced' },
  'classic-editor': { category: 'media', name: 'Classic Editor' },
  'enable-media-replace': { category: 'media', name: 'Enable Media Replace' },
  'regenerate-thumbnails': { category: 'media', name: 'Regenerate Thumbnails' },
  'media-library-assistant': { category: 'media', name: 'Media Library Assistant' },
};

// Fuzzy detection for plugins not matching exact slug
function detectPluginCategory(slug, name) {
  const s = (slug || '').toLowerCase();
  const n = (name || '').toLowerCase();
  if (WP_PLUGIN_DETECTORS[s]) return WP_PLUGIN_DETECTORS[s];

  if (n.includes('elementor') || s.includes('elementor')) return { category: 'builder', name: name || 'Elementor', builder_key: 'elementor' };
  if (n.includes('divi') || s.includes('divi')) return { category: 'builder', name: name || 'Divi', builder_key: 'divi' };
  if (n.includes('beaver') || s.includes('beaver') || s.includes('bb-plugin')) return { category: 'builder', name: name || 'Beaver Builder', builder_key: 'beaver_builder' };
  if (n.includes('brizy')) return { category: 'builder', name: name || 'Brizy', builder_key: 'brizy' };
  if (n.includes('siteorigin') || n.includes('page builder by siteorigin')) return { category: 'builder', name: name || 'SiteOrigin', builder_key: 'siteorigin' };
  if (n.includes('thrive')) return { category: 'builder', name: name || 'Thrive Architect', builder_key: 'thrust' };
  if (n.includes('woocommerce')) return { category: 'ecommerce', name: name || 'WooCommerce' };
  if (n.includes('easy digital downloads')) return { category: 'ecommerce', name: name || 'Easy Digital Downloads' };
  if (n.includes('wpforms')) return { category: 'forms', name: name || 'WPForms' };
  if (n.includes('contact form 7') || n.includes('contact-form-7')) return { category: 'forms', name: name || 'Contact Form 7' };
  if (n.includes('gravity forms')) return { category: 'forms', name: name || 'Gravity Forms' };
  if (n.includes('ninja forms')) return { category: 'forms', name: name || 'Ninja Forms' };
  if (n.includes('formidable')) return { category: 'forms', name: name || 'Formidable Forms' };
  if (n.includes('yoast') || n.includes('wordpress seo')) return { category: 'seo', name: name || 'Yoast SEO' };
  if (n.includes('rank math')) return { category: 'seo', name: name || 'Rank Math' };
  if (n.includes('all in one seo')) return { category: 'seo', name: name || 'All in One SEO' };
  if (n.includes('seopress')) return { category: 'seo', name: name || 'SEOPress' };
  if (n.includes('custom fields') || n.includes('acf')) return { category: 'custom_data', name: name || 'ACF' };
  if (n.includes('custom post type')) return { category: 'custom_data', name: name || 'CPT UI' };
  if (n.includes('jet engine') || n.includes('jetengine')) return { category: 'custom_data', name: name || 'JetEngine' };
  if (n.includes('meta box')) return { category: 'custom_data', name: name || 'Meta Box' };
  if (n.includes('pods')) return { category: 'custom_data', name: name || 'Pods' };
  // Security & Identity
  if (n.includes('wordfence')) return { category: 'security', name: name || 'Wordfence' };
  if (n.includes('ithemes') || n.includes('better wp security')) return { category: 'security', name: name || 'iThemes Security' };
  if (n.includes('sucuri')) return { category: 'security', name: name || 'Sucuri' };
  if (n.includes('limit login')) return { category: 'security', name: name || 'Limit Login Attempts' };
  if (n.includes('two factor') || n.includes('2fa')) return { category: 'security', name: name || 'Two Factor' };
  if (n.includes('members') || n.includes('user role')) return { category: 'security', name: name || 'Members' };
  if (n.includes('capability manager')) return { category: 'security', name: name || 'Capability Manager' };
  if (n.includes('wp hide')) return { category: 'security', name: name || 'WP Hide' };
  // Performance & Caching
  if (n.includes('litespeed')) return { category: 'performance', name: name || 'LiteSpeed Cache' };
  if (n.includes('wp super cache') || n.includes('supercache')) return { category: 'performance', name: name || 'WP Super Cache' };
  if (n.includes('wp rocket')) return { category: 'performance', name: name || 'WP Rocket' };
  if (n.includes('w3 total cache')) return { category: 'performance', name: name || 'W3 Total Cache' };
  if (n.includes('wp fastest cache')) return { category: 'performance', name: name || 'WP Fastest Cache' };
  if (n.includes('cache enabler')) return { category: 'performance', name: name || 'Cache Enabler' };
  if (n.includes('redis') || n.includes('object cache')) return { category: 'performance', name: name || 'Redis Cache' };
  if (n.includes('autoptimize')) return { category: 'performance', name: name || 'Autoptimize' };
  if (n.includes('cloudflare')) return { category: 'performance', name: name || 'Cloudflare' };
  if (n.includes('bunny')) return { category: 'performance', name: name || 'Bunny CDN' };
  // Communication & Events
  if (n.includes('mail smtp') || n.includes('wp smtp') || n.includes('fluent smtp') || n.includes('smtp')) return { category: 'communication', name: name || 'SMTP Plugin' };
  if (n.includes('bookly') || n.includes('booking') || n.includes('amelia')) return { category: 'communication', name: name || 'Booking Plugin' };
  if (n.includes('events calendar') || n.includes('events manager') || n.includes('event tickets')) return { category: 'communication', name: name || 'Events Plugin' };
  if (n.includes('hubspot') || n.includes('mailchimp')) return { category: 'communication', name: name || 'CRM/Email Marketing' };
  // Content & Media Operations
  if (n.includes('smush') || n.includes('imagify') || n.includes('shortpixel')) return { category: 'media', name: name || 'Image Optimizer' };
  if (n.includes('tinymce') || n.includes('classic editor')) return { category: 'media', name: name || 'Editor' };
  if (n.includes('media replace') || n.includes('regenerate thumbnails') || n.includes('media library')) return { category: 'media', name: name || 'Media Plugin' };
  return null;
}

function normalizeSlug(raw) {
  const dir = (typeof raw === 'string' ? raw : (raw.path || raw.slug || raw.name || '')).split('/')[0].trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
  return dir;
}

// Detect the 5 categories from a plugin list. Platform-agnostic structure.
function detectStackFromPlugins(activePlugins) {
  const detected = [];
  const seen = new Set();
  const structuredPlugins = [];

  for (const p of activePlugins || []) {
    const slug = normalizeSlug(p);
    const name = typeof p === 'object' ? (p.name || slug) : slug;
    if (slug === 'fixpilot') continue;

    const match = detectPluginCategory(slug, name);
    if (match) {
      structuredPlugins.push({
        slug,
        name: match.name,
        version: typeof p === 'object' ? (p.version || '') : '',
        category: match.category,
        builder_key: match.builder_key || '',
      });
      if (!seen.has(match.category)) {
        seen.add(match.category);
        detected.push({
          category: match.category,
          ...STACK_CATEGORIES[match.category],
          plugin: match.name,
          plugin_slug: slug,
        });
      }
    } else {
      structuredPlugins.push({ slug, name, version: typeof p === 'object' ? (p.version || '') : '', category: 'general' });
    }
  }

  // Determine builder type (for orchestrator compatibility)
  const builderPlugin = structuredPlugins.find(p => p.category === 'builder');
  const builderType = builderPlugin?.builder_key || 'gutenberg';

  return { detected_categories: detected, structured_plugins: structuredPlugins, builder_type: builderType };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action } = body;

    // ─── ACTION: detect_categories (no plugin call needed — pure logic) ───
    if (action === 'detect_categories') {
      const { active_plugins, active_theme } = body;
      const result = detectStackFromPlugins(active_plugins);
      return Response.json({
        success: true,
        platform: 'wordpress',
        ...result,
        active_theme: active_theme || '',
      });
    }

    // ─── ACTION: discover (fetch manifest from plugin, store on SiteSetupProfile) ───
    if (action === 'discover') {
      const { domain_id, domain_fingerprint } = body;

      let domain;
      if (domain_id) {
        const ds = await base44.asServiceRole.entities.Domain.filter({ id: domain_id });
        domain = ds[0];
      } else if (domain_fingerprint) {
        const ds = await base44.asServiceRole.entities.Domain.filter({ domain_fingerprint });
        domain = ds[0];
      }
      if (!domain) return Response.json({ error: 'Domain not found' }, { status: 404 });

      // Parse stored plugins
      let activePlugins = [];
      try { activePlugins = domain.active_plugins ? JSON.parse(domain.active_plugins) : []; } catch {}

      // Detect categories from stored plugins
      const stackDetection = detectStackFromPlugins(activePlugins);

      // Fetch the live structural manifest from the plugin
      let liveManifest = null;
      if (domain.api_key && domain.domain_name) {
        const siteUrl = domain.domain_name.startsWith('http') ? domain.domain_name : `https://${domain.domain_name}`;
        const manifestUrl = `${siteUrl}/wp-json/fixpilot/v1/manifest`;
        try {
          const response = await fetch(manifestUrl, {
            headers: { 'x-fixpilot-key': domain.api_key },
            signal: AbortSignal.timeout(20000),
          });
          if (response.ok) {
            liveManifest = await response.json();
            console.log('[siteStackDiscovery] Fetched live manifest for', domain.domain_name, '- widgets:', liveManifest?.elementor?.homepage_widgets?.length || 0);
          } else {
            console.error('[siteStackDiscovery] Plugin /manifest returned', response.status);
          }
        } catch (e) {
          console.error('[siteStackDiscovery] Failed to fetch manifest:', e.message);
        }
      }

      // Build the complete stack manifest
      const manifest = {
        platform: 'wordpress',
        discovered_at: new Date().toISOString(),
        site_url: domain.domain_name,
        wp_version: domain.wp_version || liveManifest?.wp_version || '',
        php_version: domain.php_version || liveManifest?.php_version || '',
        active_theme: domain.active_theme || liveManifest?.active_theme || '',
        builder_type: stackDetection.builder_type,
        detected_categories: stackDetection.detected_categories,
        structured_plugins: stackDetection.structured_plugins,
        elementor: liveManifest?.elementor || null,
        woocommerce: liveManifest?.woocommerce || null,
        acf: liveManifest?.acf || null,
        forms: liveManifest?.forms || [],
        custom_post_types: liveManifest?.custom_post_types || [],
        seo: liveManifest?.seo || null,
      };

      // Store on SiteSetupProfile
      let profile;
      try {
        const existing = await base44.asServiceRole.entities.SiteSetupProfile.filter({ domain_id: domain.id });
        profile = existing[0];
        const manifestJson = JSON.stringify(manifest);

        if (profile) {
          await base44.asServiceRole.entities.SiteSetupProfile.update(profile.id, {
            platform: 'wordpress',
            stack_manifest: manifestJson,
            builder_type: stackDetection.builder_type,
            active_plugins: domain.active_plugins || '[]',
            theme_name: domain.active_theme || '',
            last_updated: new Date().toISOString(),
          });
        } else {
          profile = await base44.asServiceRole.entities.SiteSetupProfile.create({
            domain_id: domain.id,
            domain_name: domain.domain_name,
            platform: 'wordpress',
            setup_fingerprint: 'pending',
            theme_name: domain.active_theme || '',
            builder_type: stackDetection.builder_type,
            stack_manifest: manifestJson,
            active_plugins: domain.active_plugins || '[]',
            fixes_attempted: 0,
            fixes_successful: 0,
            fixes_failed: 0,
            failed_approaches: '[]',
            effective_approaches: '[]',
            last_updated: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.error('[siteStackDiscovery] Failed to store manifest:', e.message);
      }

      return Response.json({
        success: true,
        manifest,
        stored: true,
      });
    }

    // ─── ACTION: get_manifest (return stored manifest from SiteSetupProfile) ───
    if (action === 'get_manifest') {
      const { domain_id, domain_fingerprint } = body;

      let domain;
      if (domain_id) {
        const ds = await base44.asServiceRole.entities.Domain.filter({ id: domain_id });
        domain = ds[0];
      } else if (domain_fingerprint) {
        const ds = await base44.asServiceRole.entities.Domain.filter({ domain_fingerprint });
        domain = ds[0];
      }
      if (!domain) return Response.json({ success: true, manifest: null });

      const profiles = await base44.asServiceRole.entities.SiteSetupProfile.filter({ domain_id: domain.id });
      const profile = profiles[0];
      if (!profile || !profile.stack_manifest) {
        return Response.json({ success: true, manifest: null, stale: true });
      }

      let manifest;
      try { manifest = JSON.parse(profile.stack_manifest); } catch { manifest = null; }

      return Response.json({ success: true, manifest, stale: false });
    }

    return Response.json({ error: 'Invalid action. Use: discover, get_manifest, or detect_categories.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});