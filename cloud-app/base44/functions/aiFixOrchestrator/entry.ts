import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

async function runVerificationCheck(check, siteUrl, domain, base44Client) {
  const { check_type, description, expected, check_url, search_string } = check;
  const url = check_url || siteUrl;

  const result = {
    check_type: check_type || 'manual_check',
    description: description || '',
    expected: expected || '',
    status: 'pending',
    details: '',
  };

  // Manual checks can't be automated
  if (check_type === 'manual_check') {
    result.status = 'manual';
    result.details = 'Requires manual verification by the site owner';
    return result;
  }

  // Option-confirmed checks are validated by the plugin during apply
  if (check_type === 'option_confirmed') {
    result.status = 'passed';
    result.details = 'Plugin confirmed the option was updated successfully during fix application';
    return result;
  }

  // ─── DB State Check: reads actual database values via plugin API (bypasses all caching) ───
  if (check_type === 'db_state_check') {
    if (!domain || !domain.api_key) {
      result.status = 'manual';
      result.details = 'Cannot verify via DB state — no API key available for this domain. Manual verification required.';
      return result;
    }

    const dbTargetType = search_string || '';
    const dbTarget = check.target || check.check_url || '';
    if (!dbTargetType || !dbTarget) {
      result.status = 'manual';
      result.details = 'DB state check missing target_type (search_string) or target. Manual verification required.';
      return result;
    }

    try {
      const verifyUrl = `${siteUrl}/wp-json/fixpilot/v1/verify-state`;
      const response = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-fixpilot-key': domain.api_key },
        body: JSON.stringify({ target_type: dbTargetType, target: dbTarget }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        result.status = 'failed';
        result.details = `DB state check failed — plugin returned HTTP ${response.status}`;
        return result;
      }

      const data = await response.json();
      if (!data.success) {
        result.status = 'failed';
        result.details = `DB state check error: ${data.error || 'Unknown error'}`;
        return result;
      }

      const dbStateStr = JSON.stringify(data);
      const expectedVal = expected || '';

      if (expectedVal && dbStateStr.includes(expectedVal)) {
        result.status = 'passed';
        result.details = `DB state verified — expected value "${expectedVal.substring(0, 80)}" found in database. This bypasses all front-end caching.`;
      } else if (expectedVal) {
        result.status = 'failed';
        result.details = `DB state check — expected "${expectedVal.substring(0, 80)}" but database returned: ${dbStateStr.substring(0, 200)}`;
      } else {
        result.status = 'passed';
        result.details = `DB state check completed — current state: ${dbStateStr.substring(0, 200)}`;
      }
      return result;
    } catch (e) {
      result.status = 'failed';
      result.details = `DB state check failed: ${e.message}`;
      return result;
    }
  }

  // ─── REST API Verify: reads any REST endpoint to verify state ───
  if (check_type === 'rest_api_verify') {
    if (!domain || !domain.api_key) {
      result.status = 'manual';
      result.details = 'Cannot verify via REST API — no API key available. Manual verification required.';
      return result;
    }

    const apiTarget = check.target || check.check_url || '';
    if (!apiTarget) {
      result.status = 'manual';
      result.details = 'REST API verify missing target route. Manual verification required.';
      return result;
    }

    try {
      const siteUrl = domain.domain_name.startsWith('http') ? domain.domain_name : `https://${domain.domain_name}`;
      const proxyUrl = `${siteUrl}/wp-json/fixpilot/v1/rest-proxy`;
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-fixpilot-key': domain.api_key },
        body: JSON.stringify({ route: apiTarget, method: 'GET' }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        result.status = 'failed';
        result.details = `REST API verify failed — HTTP ${response.status}`;
        return result;
      }

      const data = await response.json();
      if (!data.success) {
        result.status = 'failed';
        result.details = `REST API verify error: ${data.error || 'Unknown error'}`;
        return result;
      }

      const responseStr = JSON.stringify(data.response);
      const expectedVal = expected || '';

      if (expectedVal && responseStr.includes(expectedVal)) {
        result.status = 'passed';
        result.details = `REST API verified — expected value "${expectedVal.substring(0, 80)}" found in endpoint response.`;
      } else if (expectedVal) {
        result.status = 'failed';
        result.details = `REST API verify — expected "${expectedVal.substring(0, 80)}" but got: ${responseStr.substring(0, 200)}`;
      } else {
        result.status = 'passed';
        result.details = `REST API check completed — endpoint responded with HTTP ${data.status_code}.`;
      }
      return result;
    } catch (e) {
      result.status = 'failed';
      result.details = `REST API verify failed: ${e.message}`;
      return result;
    }
  }

  // ─── Screenshot Compare: AI vision verification of visual changes ───
  if (check_type === 'screenshot_compare') {
    if (!base44Client) {
      result.status = 'manual';
      result.details = 'Cannot verify via screenshot — AI vision not available. Manual verification required.';
      return result;
    }

    const screenshotTargetUrl = check_url || url;
    try {
      const capturedUrl = await captureScreenshot(screenshotTargetUrl);
      if (!capturedUrl) {
        result.status = 'manual';
        result.details = 'Could not capture screenshot — screenshot service unavailable. Manual visual verification required.';
        return result;
      }

      const visionResult = await verifyWithScreenshot(capturedUrl, description || '', expected || '', screenshotTargetUrl, base44Client);
      result.status = visionResult.status || 'manual';
      result.details = visionResult.details || 'Screenshot verification completed.';
      result.screenshot_url = capturedUrl;
      return result;
    } catch (e) {
      result.status = 'failed';
      result.details = `Screenshot verification failed: ${e.message}`;
      return result;
    }
  }

  // For css_present, content_present, url_accessible — fetch the live site
  try {
    // Resolve relative URLs or placeholder URLs against the site URL
    let fetchUrl = url;
    if (!fetchUrl || !fetchUrl.startsWith('http') || fetchUrl.includes('yoursite.com') || fetchUrl.includes('example.com')) {
      if (siteUrl && siteUrl.startsWith('http')) {
        if (!fetchUrl || !fetchUrl.startsWith('http') || fetchUrl.includes('yoursite.com') || fetchUrl.includes('example.com')) {
          // Use the site URL as the base
          if (fetchUrl && !fetchUrl.includes('yoursite.com') && !fetchUrl.includes('example.com') && !fetchUrl.startsWith('http')) {
            // Relative path — append to site URL
            fetchUrl = siteUrl.replace(/\/$/, '') + (fetchUrl.startsWith('/') ? fetchUrl : '/' + fetchUrl);
          } else {
            // Placeholder or missing URL — use the site homepage
            fetchUrl = siteUrl;
          }
        }
      } else {
        result.status = 'failed';
        result.details = `Could not verify — check_url "${fetchUrl}" is a relative path or placeholder and no base site URL is available. Use full URLs (e.g. https://example.com/contact-us/) in verification plans.`;
        return result;
      }
    }

    const response = await fetch(fetchUrl, {
      headers: { 'User-Agent': 'WPBugFix-Verifier/1.0 (+https://wpbugfix.net)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });

    if (check_type === 'url_accessible') {
      if (response.ok) {
        result.status = 'passed';
        result.details = `Site is accessible — HTTP ${response.status}`;
      } else {
        result.status = 'failed';
        result.details = `Site returned HTTP ${response.status} — the page may still be broken`;
      }
      return result;
    }

    if (!response.ok) {
      result.status = 'failed';
      result.details = `Could not fetch page (HTTP ${response.status}) — verification skipped`;
      return result;
    }

    const html = await response.text();

    if (check_type === 'css_present' || check_type === 'content_present') {
      const term = search_string || expected || '';
      if (!term) {
        result.status = 'manual';
        result.details = 'No search string specified — manual verification needed';
        return result;
      }

      // Try exact match first, then try normalised (whitespace-insensitive) match
      const normalisedHtml = html.replace(/\s+/g, ' ');
      const normalisedTerm = term.replace(/\s+/g, ' ');

      if (html.includes(term) || normalisedHtml.includes(normalisedTerm)) {
        result.status = 'passed';
        result.details = `Found expected "${check_type === 'css_present' ? 'CSS rule' : 'content'}" in the live page source`;
      } else {
        result.status = 'failed';
        result.details = `Expected content not found in page source. The fix may not have propagated yet (cache), or was not applied correctly. Search string: "${term.substring(0, 80)}${term.length > 80 ? '...' : ''}"`;
      }
      return result;
    }

    result.status = 'manual';
    result.details = 'Unknown check type — manual verification required';
    return result;
  } catch (e) {
    result.status = 'failed';
    result.details = `Could not reach the site to verify: ${e.message}. The site may be down, blocking automated requests, or behind a firewall.`;
    return result;
  }
}

async function fetchWooCommerceData(domain, message) {
  if (!domain.api_key || !domain.domain_name) return null;
  const siteUrl = domain.domain_name.startsWith('http') ? domain.domain_name : `https://${domain.domain_name}`;
  const pluginUrl = `${siteUrl}/wp-json/fixpilot/v1/products`;
  try {
    const response = await fetch(pluginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-fixpilot-key': domain.api_key },
      body: JSON.stringify({ message: message, limit: 100 }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) { console.error('[woo] Plugin /products returned', response.status); return null; }
    const data = await response.json();
    if (!data.woocommerce_active) return null;
    return data;
  } catch (e) {
    console.error('[woo] Failed to fetch WooCommerce data:', e.message);
    return null;
  }
}

// ─── Fetch the Elementor Widget Map from the plugin ───
// Returns a complete map of every Elementor widget across ALL pages,
// with widget IDs, types, and text previews — the LLM uses this to
// find the exact widget ID matching the user's request.
async function fetchElementorWidgetMap(domain) {
  if (!domain.api_key || !domain.domain_name) return null;
  const siteUrl = domain.domain_name.startsWith('http') ? domain.domain_name : `https://${domain.domain_name}`;
  const mapUrl = `${siteUrl}/wp-json/fixpilot/v1/elementor-map`;
  try {
    const response = await fetch(mapUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-fixpilot-key': domain.api_key },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) { console.error('[elmap] Plugin /elementor-map returned', response.status); return null; }
    const data = await response.json();
    if (!data.success || !data.elementor_active) return null;
    return data;
  } catch (e) {
    console.error('[elmap] Failed to fetch Elementor widget map:', e.message);
    return null;
  }
}

async function buildWidgetMapContext(widgetMap, base44Client, message) {
  if (!widgetMap || !widgetMap.pages || widgetMap.pages.length === 0) return '';
  await loadWidgetSchemas(base44Client);
  const SC = _widgetSchemas, LM = _widgetLangMap;
  const onsiteTypes = new Set();
  for (const page of widgetMap.pages) { for (const w of page.widgets) { onsiteTypes.add(w.type); } }
  const lines = ['\nELEMENTOR WIDGET MAP:', `${widgetMap.page_count} pages, ${widgetMap.total_widgets} widgets. Match the user's request text to the "Settings" column below to identify the target widget ID, then follow the ELEMENTOR DECISION TREE in the instructions to choose the correct change type.`];
  for (const page of widgetMap.pages) {
    const isEl = (page.elementor_edit_mode || 'none') === 'builder';
    lines.push(`Page: "${page.page_title}" (slug: ${page.page_slug})${isEl ? ' [Elementor]' : ' [NOT Elementor — use post_update]'}`);
    if (!isEl && page.content_preview) lines.push(`  HTML: ${page.content_preview}`);
    for (const w of page.widgets) {
      const s = SC[w.type]; const pv = Object.entries(w.settings_preview || {}).map(([k, v]) => `${k}="${v}"`).join(', ');
      const sp = s ? Object.keys(s.style_properties).slice(0, 5).join(', ') : '';
      lines.push(`  ID: ${w.id} | ${w.type}${s ? ` (${s.label})` : ''} | Settings: ${pv || 'none'}${sp ? ` | Props: ${sp}` : ''}`);
    }
  }
  const onsite = [...onsiteTypes].filter(t => SC[t]);
  if (onsite.length) {
    lines.push('\nWIDGET SCHEMA (style + content props + fix strategy):');
    for (const t of onsite) { const s = SC[t]; lines.push(`${t} (${s.label}): STYLE=[${Object.keys(s.style_properties).join(', ')}] CONTENT=[${Object.keys(s.content_properties).join(', ')}] FIX: ${s.fix_strategy}`); }
    lines.push('\nWIDGET LANGUAGE HINTS (match user phrases to widget types):');
    for (const t of onsite) { const tr = LM[t]; if (tr) lines.push(`${t}: ${tr.slice(0, 8).join(', ')}`); }
  }
  if (message) {
    try {
      const tmRes = await base44Client.asServiceRole.functions.invoke('widgetSchemaRegistry', { action: 'match_template', message });
      const tm = tmRes.data || tmRes;
      if (tm && tm.confidence) {
        lines.push(`\nTEMPLATE MATCH (use as PRIMARY approach): ${tm.template_name} (confidence: ${tm.confidence})`);
        lines.push(`Change type: ${tm.change_type} | Widget types: ${(tm.widget_types || []).join(', ')}`);
        lines.push(`Build hint: ${tm.build_hint}`);
      }
    } catch (e) { /* silent */ }
  }
  return lines.join('\n');
}

async function discoverSiteRoutes(domain) {
  if (!domain.api_key || !domain.domain_name) return null;
  const siteUrl = domain.domain_name.startsWith('http') ? domain.domain_name : `https://${domain.domain_name}`;
  const discoverUrl = `${siteUrl}/wp-json/fixpilot/v1/discover`;
  try {
    const response = await fetch(discoverUrl, {
      headers: { 'x-fixpilot-key': domain.api_key },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) { console.error('[discover] Plugin /discover returned', response.status); return null; }
    const data = await response.json();
    if (!data.success) return null;

    const interestingRoutes = (data.routes || []).filter(r => {
      const route = r.route || '';
      if (route.startsWith('/wp/v2/') && !route.includes('/settings')) return false;
      if (route.startsWith('/wp-site-health/')) return false;
      return true;
    }).slice(0, 100);

    return { total_routes: data.route_count, routes: interestingRoutes };
  } catch (e) {
    console.error('[discover] Failed to discover routes:', e.message);
    return null;
  }
}

const THEME_SELECTOR_MAP = {
  astra: { selectors: ['.ast-menu-link', '.main-header-menu .menu-link', '.ast-header-break-point'], settings_hint: 'Appearance → Customize → Header → Primary Menu → Colors/Design' },
  striz: { selectors: ['.striz-nav-menu', '.nav-menu .menu-item a', '.striz-header .menu-link'], settings_hint: 'Appearance → Customize → Header → Menu' },
  elementor: { selectors: ['.elementor-nav-menu .menu-item a', '.elementor-nav-menu--main'], settings_hint: 'Elementor Editor → Edit Nav Menu widget → Style tab' },
  divi: { selectors: ['#top-menu li a', '.et-menu-nav li a'], settings_hint: 'Divi Theme Options → Menu → Colors, or Divi Builder module settings' },
  generatepress: { selectors: ['.main-nav .menu-item a', '.main-navigation .menu-item a'], settings_hint: 'Appearance → Customize → Colors → Primary Navigation' },
  avada: { selectors: ['.fusion-menu .menu-item a', '.fusion-main-menu'], settings_hint: 'Avada Theme Options → Menu → Styling' },
  oceanwp: { selectors: ['#site-navigation .menu-item a', '.oceanwp-mobile-menu-icon'], settings_hint: 'Appearance → Customize → Header → Menu' },
  flatsome: { selectors: ['.nav li a', '.header-nav .menu-item a'], settings_hint: 'Flatsome Theme Options → Header → Menu' },
  block: { selectors: ['.wp-block-navigation-item__content', '.wp-block-navigation a'], settings_hint: 'Site Editor → Navigation block → Settings panel' },
};

function detectThemeKey(themeName) {
  const t = (themeName || '').toLowerCase();
  if (t.includes('astra')) return 'astra';
  if (t.includes('striz') || t.includes('strix')) return 'striz';
  if (t.includes('elementor')) return 'elementor';
  if (t.includes('divi')) return 'divi';
  if (t.includes('generate')) return 'generatepress';
  if (t.includes('avada')) return 'avada';
  if (t.includes('ocean')) return 'oceanwp';
  if (t.includes('flatsome')) return 'flatsome';
  if (t.includes('twenty twenty') || t.includes('block')) return 'block';
  return null;
}

const BUILDER_PREFERENCE_MAP = {
  elementor: {
    name: 'Elementor',
    preferred_changes: ['post_meta_update', 'post_content_patch', 'generic_option_update', 'rest_api_call', 'post_update'],
    last_resort: 'css_inject',
    option_keys: { global_colors: 'elementor_active_kit', global_typography: 'elementor_scheme_typography_4', site_settings: 'elementor_site_settings' },
    guidance: 'Elementor pages store content in _elementor_data (widget settings JSON), NOT in post_content. The decision tree is: (1) Widget-level property change (changing a specific widget setting like title text, color, font — you have the widget ID from the Widget Map) → post_meta_update with {widget_id, updates}. (2) Text styling (wrapping specific words/phrases in a <span> like color/bold/italic) → post_content_patch with {search, replace} — the plugin auto-detects Elementor and patches _elementor_data. (3) Global/site-wide settings (Elementor kit colors, typography, site settings) → generic_option_update. (4) Non-Elementor pages → post_content_patch (auto-falls back to post_content). NEVER use post_update to replace full Elementor page content — it destroys the page. NEVER use css_inject unless all native pathways are exhausted.',
  },
  divi: {
    name: 'Divi',
    preferred_changes: ['generic_option_update', 'option_update'],
    last_resort: 'css_inject',
    option_keys: { theme_options: 'et_divi', module_presets: 'et_pb_layout_settings' },
    guidance: 'Divi stores theme options in the "et_divi" wp_options key. Use generic_option_update to modify these. For page changes, update the post content with the Divi shortcode format.',
  },
  beaver_builder: {
    name: 'Beaver Builder',
    preferred_changes: ['generic_option_update', 'post_update'],
    last_resort: 'css_inject',
    option_keys: { global_settings: 'fl-builder-settings' },
    guidance: 'Beaver Builder stores settings in "fl-builder-settings" wp_options. Page layouts in post meta "_fl_builder_data". Use generic_option_update for global settings, post_update for page-level changes.',
  },
  brizy: {
    name: 'Brizy',
    preferred_changes: ['generic_option_update', 'post_update'],
    last_resort: 'css_inject',
    guidance: 'Brizy stores page data in post meta "brizy_page_data". Use post_update to modify Brizy pages.',
  },
  siteorigin: {
    name: 'SiteOrigin',
    preferred_changes: ['post_update', 'generic_option_update'],
    last_resort: 'css_inject',
    guidance: 'SiteOrigin stores page builder data in post content as panels_data. Use post_update to modify.',
  },
  thrust: {
    name: 'Thrive Architect',
    preferred_changes: ['post_update', 'generic_option_update'],
    last_resort: 'css_inject',
    guidance: 'Thrive Architect stores page content in post_content with TCB shortcodes. Use post_update.',
  },
  gutenberg: {
    name: 'Gutenberg (Block Editor)',
    preferred_changes: ['post_update', 'option_update', 'generic_option_update'],
    last_resort: 'css_inject',
    guidance: 'Gutenberg stores content as block HTML in post_content. Use post_update to modify page content. Theme styles via option_update with theme_mods_{theme_slug}.',
  },
};

// Schemas + language maps + templates are fetched from widgetSchemaRegistry function
let _widgetSchemas = null;
let _widgetLangMap = null;
async function loadWidgetSchemas(base44Client) {
  if (_widgetSchemas) return;
  try {
    const res = await base44Client.asServiceRole.functions.invoke('widgetSchemaRegistry', { action: 'get_schemas', builder_type: 'elementor' });
    const data = res.data || res;
    _widgetSchemas = data.schemas || {};
    _widgetLangMap = data.language_map || {};
  } catch (e) { console.error('[schemas] Registry fetch failed:', e.message); _widgetSchemas = {}; _widgetLangMap = {}; }
}

function detectBuilderType(plugins, themeName) {
  const pluginList = Array.isArray(plugins) ? plugins : [];
  const pluginNames = pluginList.map(p => typeof p === 'string' ? p.toLowerCase() : (p.name || '').toLowerCase());
  const theme = (themeName || '').toLowerCase();

  if (pluginNames.some(n => n.includes('elementor'))) return 'elementor';
  if (theme.includes('divi') || pluginNames.some(n => n.includes('divi') || n.includes('et_'))) return 'divi';
  if (pluginNames.some(n => n.includes('beaver builder') || n.includes('bb-plugin') || n.includes('fl-builder'))) return 'beaver_builder';
  if (pluginNames.some(n => n.includes('brizy'))) return 'brizy';
  if (pluginNames.some(n => n.includes('siteorigin panels') || n.includes('page builder by siteorigin'))) return 'siteorigin';
  if (pluginNames.some(n => n.includes('thrive architect') || n.includes('thrive visual'))) return 'thrust';
  return 'gutenberg';
}

function createSetupFingerprint(context) {
  const theme = (context?.active_theme || '').toLowerCase();
  const builder = detectBuilderType(context?.active_plugins, theme);
  const plugins = (context?.active_plugins || []).map(p => {
    const n = typeof p === 'string' ? p.toLowerCase() : (p.name || '').toLowerCase();
    return n.split('/')[0].trim();
  }).sort().join(',');
  const wpVer = context?.wp_version || '';
  const fingerprint = `${builder}|${theme}|${wpVer}|${plugins}`;
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    hash = ((hash << 5) - hash) + fingerprint.charCodeAt(i);
    hash = hash & hash;
  }
  return `fp_${Math.abs(hash).toString(36)}`;
}

async function updateSiteSetupProfile(base44Client, domain, siteContext, builderType, setupFingerprint) {
  try {
    const existing = await base44Client.asServiceRole.entities.SiteSetupProfile.filter({ domain_id: domain.id });
    const pageStructure = siteContext?.page_structure || {};
    const profileData = {
      domain_id: domain.id,
      domain_name: domain.domain_name,
      setup_fingerprint: setupFingerprint,
      theme_name: siteContext?.active_theme || domain.active_theme || '',
      builder_type: builderType,
      active_plugins: siteContext?.active_plugins ? JSON.stringify(siteContext.active_plugins) : domain.active_plugins || '[]',
      css_class_patterns: JSON.stringify((pageStructure.css_classes || []).slice(0, 100)),
      nav_structure: JSON.stringify(pageStructure.nav_links || ''),
      body_classes: pageStructure.body_classes || '',
      wp_version: siteContext?.wp_version || domain.wp_version || '',
      php_version: siteContext?.php_version || domain.php_version || '',
      last_updated: new Date().toISOString(),
    };
    if (existing[0]) {
      await base44Client.asServiceRole.entities.SiteSetupProfile.update(existing[0].id, {
        ...profileData,
        fixes_attempted: existing[0].fixes_attempted || 0,
        fixes_successful: existing[0].fixes_successful || 0,
        fixes_failed: existing[0].fixes_failed || 0,
        failed_approaches: existing[0].failed_approaches || '[]',
        effective_approaches: existing[0].effective_approaches || '[]',
      });
    } else {
      await base44Client.asServiceRole.entities.SiteSetupProfile.create({
        ...profileData,
        fixes_attempted: 0,
        fixes_successful: 0,
        fixes_failed: 0,
        failed_approaches: '[]',
        effective_approaches: '[]',
      });
    }
  } catch (e) {
    console.error('[profile] Failed to update site setup profile:', e.message);
  }
}

async function querySetupKnowledgeBase(base44Client, setupFingerprint, builderType, domainId, message) {
  const messageLower = (message || '').toLowerCase();
  const results = {
    matching_recipes: [],
    past_successes: [],
    past_failures: [],
    builder_guidance: BUILDER_PREFERENCE_MAP[builderType] || null,
    builder_type: builderType,
  };

  try {
    const allRecipes = await base44Client.asServiceRole.entities.FixRecipe.filter({ status: 'verified' }, '-success_count', 100);
    const scored = allRecipes.map(r => {
      let score = 0;
      const tags = (r.setup_tags || r.tags || '').toLowerCase();
      const titleLower = (r.title || '').toLowerCase();
      const descLower = (r.description || '').toLowerCase();
      if (tags.includes(builderType)) score += 5;
      if (r.builder_type && r.builder_type === builderType) score += 3;
      const words = messageLower.split(/\s+/);
      for (const w of words) {
        if (w.length < 3) continue;
        if (titleLower.includes(w)) score += 3;
        if (descLower.includes(w)) score += 2;
      }
      return { recipe: r, score };
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);

    results.matching_recipes = scored.slice(0, 5).map(s => ({
      title: s.recipe.title,
      category: s.recipe.category,
      fix_template: s.recipe.fix_template ? s.recipe.fix_template.substring(0, 500) : '',
      builder_type: s.recipe.builder_type || '',
      effective_approach: s.recipe.effective_approach || '',
      success_count: s.recipe.success_count || 0,
      description: s.recipe.description,
    }));
  } catch (e) {
    console.error('[kb] Recipe query failed:', e.message);
  }

  try {
    const pastFixes = await base44Client.asServiceRole.entities.FixExecution.filter({ domain_id: domainId }, '-created_date', 20);
    for (const fix of pastFixes) {
      const fixDesc = (fix.fix_description || '').toLowerCase();
      let relevance = 0;
      const words = messageLower.split(/\s+/);
      for (const w of words) {
        if (w.length < 3) continue;
        if (fixDesc.includes(w)) relevance += 2;
      }
      if (relevance < 2) continue;

      let changeTypes = [];
      try { changeTypes = JSON.parse(fix.change_types_used || '[]'); } catch {}

      const entry = {
        description: fix.fix_description,
        change_types: changeTypes,
        verification_status: fix.verification_status,
        fix_category: fix.fix_category,
        builder_type: fix.builder_type || '',
      };
      if (fix.verification_status === 'passed') results.past_successes.push(entry);
      else if (fix.verification_status === 'failed') results.past_failures.push(entry);
    }
    results.past_successes = results.past_successes.slice(0, 3);
    results.past_failures = results.past_failures.slice(0, 5);
  } catch (e) {
    console.error('[kb] Past fix query failed:', e.message);
  }

  return results;
}

async function queryPluginCapabilities(base44Client, activePlugins) {
  const detected = [];
  const seen = new Set();
  for (const p of activePlugins || []) {
    const raw = typeof p === 'string' ? p : (p.path || p.slug || p.name || '');
    const dir = raw.split('/')[0].trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
    if (dir && !seen.has(dir)) {
      seen.add(dir);
      detected.push({ slug: dir, name: typeof p === 'object' ? (p.name || dir) : dir });
    }
  }

  const capabilitiesByPlugin = {};
  const pluginsNeedingResearch = [];
  for (const { slug, name } of detected) {
    try {
      const caps = await base44Client.asServiceRole.entities.PluginCapability.filter({ plugin_slug: slug }, 'created_date', 60);
      if (!caps.length || caps.length < 5) {
        pluginsNeedingResearch.push({ slug, name, known_count: caps.length });
      }
      if (caps.length) {
        capabilitiesByPlugin[slug] = caps.slice(0, 40).map(c => ({
          type: c.capability_type,
          identifier: c.identifier,
          method: c.method || '',
          version_tested: c.version_tested || '',
          description: (c.description || '').substring(0, 120),
          fix_guidance: (c.fix_guidance || '').substring(0, 200),
          confidence: c.confidence_score || 0.5,
        }));
      }
    } catch (e) {
      console.error('[capabilities] Failed to query for', slug, e.message);
    }
  }

  return { capabilitiesByPlugin, pluginsNeedingResearch };
}

const SIMPLE_CSS_KEYWORDS = ['color', 'colour', 'font', 'align', 'center', 'margin', 'padding', 'width', 'height', 'hide', 'hidden', 'visible', 'background', 'border', 'radius', 'shadow', 'opacity', 'spacing', 'nav', 'menu', 'header', 'footer', 'button', 'hover', 'bold', 'uppercase', 'text size', 'font size', 'text colour', 'text color', 'move', 'position', 'float'];

const COMPLEX_KEYWORDS = ['not working', 'broken', 'error', 'debug', 'not sending', 'crash', 'white screen', '500', '404', 'redirect', 'vulnerability', 'security', 'hack', 'malware', 'checkout', 'cart', 'payment', 'plugin conflict', 'backup', 'restore', 'database', 'sql', 'fatal', 'smtp', 'email not', 'form not', 'form field', 'form label', 'field name', 'field label', 'contact form', 'form title', 'woocommerce', 'product', 'order', 'inventory', 'stock'];

function isSimpleCssRequest(message) {
  const msgLower = message.toLowerCase();
  if (COMPLEX_KEYWORDS.some(kw => msgLower.includes(kw))) return false;
  return SIMPLE_CSS_KEYWORDS.some(kw => msgLower.includes(kw));
}

// Detect when the user EXPLICITLY forbids CSS/styling and demands a plugin/theme-native change.
function explicitlyForbidsCss(message) {
  const m = (message || '').toLowerCase();
  return /no\s*css|don'?t use (?:any )?(?:css|styling|styles?)|not(?:hing)? via css|avoid css|without css|do not use (?:css|styling)|use the (?:plugin|theme|form|elementor|builder)|access the (?:form|plugin|form software)/.test(m);
}

// ─── Classify the user's request to determine which context sections to inject ───
// This keeps the LLM prompt focused and short (~2500 tokens vs ~5000) by only
// including sections relevant to the request type.
function classifyRequest(message) {
  const m = (message || '').toLowerCase();
  if (/\b(product|products|price|prices|sale|discount|stock|inventory|cart|checkout|coupon|shipping|order|orders|woocommerce|woo)\b/.test(m)) return 'woocommerce';
  if (/\b(form|field|label|contact form|submit|input|textarea|checkbox|radio|dropdown|select option)\b/.test(m)) return 'forms';
  if (/\b(color|colour|font|align|center|margin|padding|width|height|hide|hidden|visible|background|border|radius|shadow|opacity|spacing|bold|italic|underline|uppercase|lowercase|capitalize|text size|font size|font style|font weight|text style|heading|button|image|icon|divider|accordion|testimonial|counter|social|position|float|move)\b/.test(m)) return 'elementor_visual';
  if (/\b(not working|broken|error|debug|crash|white screen|500|404|redirect|fatal|smtp|email not|plugin conflict|backup|restore|database|sql)\b/.test(m)) return 'troubleshooting';
  if (/\b(menu|nav|navigation|header|footer|sidebar|layout|theme|customizer|widget area)\b/.test(m)) return 'theme_settings';
  return 'general';
}

// Build plugin-native guidance for form plugins so label/field/text changes edit the form, not CSS.
function buildFormPluginGuidance(activePlugins) {
  const names = (activePlugins || []).map(p => (typeof p === 'string' ? p : (p.name || '')).toLowerCase());
  if (names.some(n => n.includes('contact form 7') || n.includes('contact-form-7'))) {
    return `\nFORM PLUGIN DETECTED: Contact Form 7\nContact Form 7 stores each form as a custom post type "wpcf7_contact_form". Field labels live in the form body (post_content) as mail-tag shortcodes, e.g. [text* organisation-name "Organisation Name"].\nTo change a field LABEL or any form text: use "post_update" with target = the CF7 form's post ID or the form TITLE (the plugin resolves the title), and value = the updated form body (same body with only the label text inside the quotes changed). Do NOT use css_inject for label/text/field changes. If you don't know the form ID, use rest_api_call GET /wp/v2/wpcf7_contact_form to list forms, or ask the user for the form name.`;
  }
  if (names.some(n => n.includes('wpforms'))) {
    return `\nFORM PLUGIN DETECTED: WPForms\nWPForms stores each form as a "wpforms" custom post type with field config in post meta "_wpforms_form". To change a field label: use "post_meta_update" with target = the form post ID or title, value = JSON {"meta_key":"_wpforms_form","meta_value":<updated form JSON array with the label changed>}. Do NOT use css_inject for label changes.`;
  }
  if (names.some(n => n.includes('gravity forms') || n.includes('gravityforms'))) {
    return `\nFORM PLUGIN DETECTED: Gravity Forms\nGravity Forms stores form definitions in wp_gf_form_meta. To change a field label, use rest_api_call PUT /gf/v2/forms/{id} with the updated field object in params. Do NOT use css_inject for label changes.`;
  }
  if (names.some(n => n.includes('ninja forms'))) {
    return `\nFORM PLUGIN DETECTED: Ninja Forms\nNinja Forms stores form data as a custom post type with field settings in the form JSON. Use rest_api_call to the Ninja Forms API or post_meta_update on the form post. Do NOT use css_inject for label changes.`;
  }
  return '';
}

async function fetchLiveSiteContext(domain) {
  if (!domain.api_key || !domain.domain_name) return null;
  const siteUrl = domain.domain_name.startsWith('http') ? domain.domain_name : `https://${domain.domain_name}`;
  const contextUrl = `${siteUrl}/wp-json/fixpilot/v1/context`;
  try {
    const response = await fetch(contextUrl, {
      headers: { 'x-fixpilot-key': domain.api_key },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) { console.error('[context] Plugin /context returned', response.status); return null; }
    const data = await response.json();
    return {
      wp_version: data.wp_version || '',
      php_version: data.php_version || '',
      active_theme: data.active_theme || '',
      active_plugins: data.active_plugins || [],
      current_screen: data.current_screen || '',
      page_structure: data.page_structure || {},
      site_url: data.site_url || siteUrl,
    };
  } catch (e) {
    console.error('[context] Failed to fetch live site context:', e.message);
    return null;
  }
}

// ─── Retrieve the stored Stack Manifest from SiteSetupProfile ───
// The manifest is populated by siteStackDiscovery during domain registration.
// If missing or stale, trigger discovery in the background (non-blocking).
async function getStackManifest(base44Client, domain) {
  try {
    const profiles = await base44Client.asServiceRole.entities.SiteSetupProfile.filter({ domain_id: domain.id });
    const profile = profiles[0];
    if (!profile || !profile.stack_manifest) {
      // Trigger discovery in the background — don't block the research call
      base44Client.functions.invoke('siteStackDiscovery', { action: 'discover', domain_id: domain.id }).catch(e => console.error('[stack] Background discovery failed:', e.message));
      console.log('[stack] No stored manifest — triggered background discovery for', domain.domain_name);
      return null;
    }
    const manifest = JSON.parse(profile.stack_manifest);
    // If manifest is older than 7 days, refresh in the background
    const age = Date.now() - new Date(manifest.discovered_at || 0).getTime();
    if (age > 7 * 24 * 60 * 60 * 1000) {
      base44Client.functions.invoke('siteStackDiscovery', { action: 'discover', domain_id: domain.id }).catch(() => {});
    }
    return manifest;
  } catch (e) {
    console.error('[stack] Failed to retrieve manifest:', e.message);
    return null;
  }
}

// ─── Build the Stack Context block for the LLM prompt ───
// This is the structured injection that lets the model do dictionary lookups
// instead of reasoning about how the builder works.
// ─── Build a CONDITIONAL stack context — only includes sections relevant to the request type ───
// This replaces the old "inject everything" approach. The widget schema registry
// is NOT included here — it's injected by buildWidgetMapContext only for widget
// types that actually exist on the site, saving ~1500 tokens.
function buildStackContext(manifest, builderType, requestType) {
  if (!manifest) return '';

  const isVisual = requestType === 'elementor_visual' || requestType === 'theme_settings';
  const isWoo = requestType === 'woocommerce';
  const isForms = requestType === 'forms';
  const isTroubleshooting = requestType === 'troubleshooting' || requestType === 'general';

  const lines = [];

  // Elementor — only for visual/theme requests
  if (isVisual && manifest.elementor && manifest.elementor.active) {
    const el = manifest.elementor;
    lines.push(`Elementor active — Kit ID: ${el.kit_id} | Homepage: "${el.homepage_title}" (ID: ${el.homepage_id})`);
    if (el.homepage_widgets && el.homepage_widgets.length > 0) {
      lines.push(`Homepage widgets (${el.homepage_widget_count}):`);
      for (const w of el.homepage_widgets) {
        const previewStr = Object.entries(w.settings_preview || {}).map(([k, v]) => `${k}="${v}"`).join(', ');
        lines.push(`  ID: ${w.id} | ${w.type} | Settings: ${previewStr || 'none'}`);
      }
    }
  }

  // WooCommerce — only for woo requests
  if (isWoo && manifest.woocommerce && manifest.woocommerce.active) {
    const woo = manifest.woocommerce;
    lines.push(`WooCommerce: ${woo.product_count} products, ${woo.category_count} categories, Currency: ${woo.currency}`);
    if (woo.categories) lines.push(`  Categories: ${woo.categories.map(c => `${c.name}(${c.slug})`).join(', ')}`);
  }

  // Forms — only for form requests
  if (isForms && manifest.forms && manifest.forms.length > 0) {
    for (const f of manifest.forms) {
      lines.push(`Forms (${f.plugin}): ${f.forms.map(ff => `"${ff.title}"(ID:${ff.id})`).join(', ')}`);
    }
  }

  // ACF/CPTs/SEO — only for troubleshooting/general
  if (isTroubleshooting) {
    if (manifest.detected_categories && manifest.detected_categories.length > 0) {
      lines.push(`Stack: ${manifest.detected_categories.map(c => `${c.name}(${c.plugin})`).join(', ')}`);
    }
    if (manifest.acf && manifest.acf.active) {
      lines.push(`ACF: ${manifest.acf.group_count} field groups`);
    }
    if (manifest.custom_post_types && manifest.custom_post_types.length > 0) {
      lines.push(`CPTs: ${manifest.custom_post_types.map(c => c.name).join(', ')}`);
    }
    if (manifest.seo && manifest.seo.active) {
      lines.push(`SEO: ${manifest.seo.plugin}`);
    }
  }

  return lines.length > 0 ? '\n' + lines.join('\n') : '';
}

async function captureScreenshot(url) {
  try {
    const cacheBustedUrl = url + (url.includes('?') ? '&' : '?') + '_cb=' + Date.now();
    const microlinkUrl = `https://api.microlink.io/?url=${encodeURIComponent(cacheBustedUrl)}&screenshot=true&meta=false&force=true`;
    const response = await fetch(microlinkUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(30000),
    });
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success' && data.data?.screenshot?.url) {
        return data.data.screenshot.url;
      }
    }
    console.error('[screenshot] Microlink returned', response.status);
  } catch (e) {
    console.error('[screenshot] Microlink failed:', e.message);
  }
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=1280&h=800`;
}

async function verifyWithScreenshot(screenshotUrl, fixDescription, expectedOutcome, targetUrl, base44Client) {
  try {
    const llmResponse = await base44Client.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a visual verification AI for WordPress fixes. A fix was applied to a WordPress site.

Fix description: "${fixDescription}"
Expected visual outcome: "${expectedOutcome}"
Page URL: ${targetUrl}

Analyze the screenshot above and determine if the fix appears to have been applied correctly. Look for visual evidence that the described change is visible — colors, layout, text content, element positioning, spacing, alignment, and overall page appearance.

Respond with ONLY a JSON object: {"status": "passed" or "failed", "details": "brief explanation of what you see"}`,
      file_urls: [screenshotUrl],
      response_json_schema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["passed", "failed"] },
          details: { type: "string" }
        }
      }
    });
    return llmResponse;
  } catch (e) {
    console.error('[screenshot] LLM vision verification failed:', e.message);
    return { status: 'failed', details: `Screenshot LLM verification failed: ${e.message}` };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action } = body;

    // ─── ACTION: Register Domain (auto-registration from plugin) ───
    if (action === 'register_domain') {
      const { domain_fingerprint, site_url, admin_email, site_name, wp_version, php_version, active_theme, active_plugins } = body;

      if (!domain_fingerprint) {
        return Response.json({ error: 'domain_fingerprint is required' }, { status: 400 });
      }

      const domains = await base44.asServiceRole.entities.Domain.filter({ domain_fingerprint });
      let domain = domains[0];

      const cleanUrl = (site_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

      if (!domain) {
        domain = await base44.asServiceRole.entities.Domain.create({
          domain_name: cleanUrl || 'unknown',
          domain_fingerprint,
          api_key: body.api_key || '',
          owner_email: admin_email || 'plugin-registered',
          owner_name: site_name || '',
          subscription_tier: 'free',
          subscription_status: 'none',
          fix_count_used: 0,
          fix_count_limit: 3,
          wp_version: wp_version || '',
          php_version: php_version || '',
          active_theme: active_theme || '',
          active_plugins: active_plugins ? JSON.stringify(active_plugins) : '',
          last_active: new Date().toISOString(),
        });
        console.log('[register_domain] Created new domain:', domain.id, domain.domain_name);
      } else {
        domain = await base44.asServiceRole.entities.Domain.update(domain.id, {
          domain_name: cleanUrl || domain.domain_name,
          api_key: body.api_key || domain.api_key,
          owner_email: admin_email || domain.owner_email,
          owner_name: site_name || domain.owner_name,
          wp_version: wp_version || domain.wp_version,
          php_version: php_version || domain.php_version,
          active_theme: active_theme || domain.active_theme,
          active_plugins: active_plugins ? JSON.stringify(active_plugins) : domain.active_plugins,
          last_active: new Date().toISOString(),
        });
        console.log('[register_domain] Updated existing domain:', domain.id);
      }

      // ─── Create/Update Site Setup Profile (stores unique setup for KB learning) ───
      try {
        const regBuilder = detectBuilderType(active_plugins, active_theme);
        const regFingerprint = createSetupFingerprint({ active_theme, active_plugins, wp_version });
        await updateSiteSetupProfile(base44, domain, { active_theme, active_plugins, wp_version, php_version, page_structure: {} }, regBuilder, regFingerprint);
      } catch (e) {
        console.error('[register_domain] Setup profile update failed:', e.message);
      }

      // ─── Ingest knowledge for EVERY plugin on this new site (grows the PluginCapability KB) ───
      try {
        base44.functions.invoke('pluginKnowledgeIngester', { action: 'ingest_site_plugins', active_plugins: active_plugins || [], active_theme: active_theme || '' }).catch(e => console.error('[register_domain] Knowledge ingestion failed:', e.message));
        console.log('[register_domain] Triggered full site knowledge ingestion for', (active_plugins || []).length, 'plugins');
      } catch (e) {
        console.error('[register_domain] Knowledge ingestion trigger failed:', e.message);
      }

      // ─── Proactive Stack Discovery: fetch structural manifest (Elementor widgets, Woo, ACF, forms) ───
      try {
        base44.functions.invoke('siteStackDiscovery', { action: 'discover', domain_id: domain.id }).catch(e => console.error('[register_domain] Stack discovery failed:', e.message));
        console.log('[register_domain] Triggered stack discovery for', domain.domain_name);
      } catch (e) {
        console.error('[register_domain] Stack discovery trigger failed:', e.message);
      }

      // Auto-trigger a site health scan for newly registered domains
      try {
        const scan = await base44.asServiceRole.entities.SiteHealthScan.create({
          domain_id: domain.id,
          domain_name: domain.domain_name,
          scan_date: new Date().toISOString(),
          status: 'scanning',
          progress: 0,
          current_step: 'Auto-scan triggered on plugin install...',
          issues: '[]',
          total_issues: 0,
        });
        base44.functions.invoke('siteHealthScan', { action: 'run', scan_id: scan.id }).catch(() => {});
        console.log('[register_domain] Auto-scan started:', scan.id);
      } catch (e) {
        console.error('[register_domain] Failed to auto-start scan:', e.message);
      }

      return Response.json({
        success: true,
        domain_id: domain.id,
        domain_name: domain.domain_name,
        owner_email: domain.owner_email,
        subscription_tier: domain.subscription_tier,
        subscription_status: domain.subscription_status,
        fix_count_used: domain.fix_count_used,
        fix_count_limit: domain.fix_count_limit,
      });
    }

    // ─── ACTION: Get Domain Status (dashboard) ───
    if (action === 'get_domain_status') {
      const { domain_fingerprint, domain_id } = body;

      let domain;
      if (domain_id) {
        const domains = await base44.asServiceRole.entities.Domain.filter({ id: domain_id });
        domain = domains[0];
      } else if (domain_fingerprint) {
        const domains = await base44.asServiceRole.entities.Domain.filter({ domain_fingerprint });
        domain = domains[0];
      }

      if (!domain) {
        return Response.json({ error: 'Domain not found' }, { status: 404 });
      }

      const fixes = await base44.asServiceRole.entities.FixExecution.filter({ domain_id: domain.id }, '-created_date', 10);

      return Response.json({
        success: true,
        domain_id: domain.id,
        domain_name: domain.domain_name,
        owner_email: domain.owner_email,
        subscription_tier: domain.subscription_tier,
        subscription_status: domain.subscription_status,
        fix_count_used: domain.fix_count_used,
        fix_count_limit: domain.fix_count_limit,
        wp_version: domain.wp_version,
        php_version: domain.php_version,
        active_theme: domain.active_theme,
        last_active: domain.last_active,
        recent_fixes: fixes.map(f => ({
          id: f.id,
          fix_description: f.fix_description,
          fix_category: f.fix_category,
          status: f.status,
          verification_status: f.verification_status,
          created_date: f.created_date,
        })),
      });
    }

    // ─── ACTION: Get Learning Status (plugin dashboard progress bar) ───
    if (action === 'get_learning_status') {
      const { domain_fingerprint, domain_id } = body;

      let domain;
      if (domain_id) {
        const domains = await base44.asServiceRole.entities.Domain.filter({ id: domain_id });
        domain = domains[0];
      } else if (domain_fingerprint) {
        const domains = await base44.asServiceRole.entities.Domain.filter({ domain_fingerprint });
        domain = domains[0];
      }

      if (!domain) {
        return Response.json({ success: true, total_plugins: 0, mapped_plugins: 0, progress_pct: 0, current_step: 'Connecting to your site...', learning_complete: false, setup_profile_built: false, estimated_seconds_remaining: 0, domain_found: false });
      }

      let activePlugins = [];
      try { activePlugins = domain.active_plugins ? JSON.parse(domain.active_plugins) : []; } catch {}

      const detected = [];
      const seen = new Set();
      for (const p of activePlugins) {
        const raw = typeof p === 'string' ? p : (p.path || p.slug || p.name || '');
        const dir = raw.split('/')[0].trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
        if (dir && !seen.has(dir)) { seen.add(dir); detected.push(dir); }
      }

      // Exclude FixPilot itself — it's our own plugin and will never have KB entries
      const learnableSlugs = detected.filter(s => s !== 'fixpilot');

      // Per-plugin queries (limit 5 each) — scales correctly as the KB grows
      // beyond 1000 records. The old bulk query capped at 1000 and missed plugins
      // whose capabilities were created later, causing false "unmapped" stalls.
      let mapped = 0;
      for (const slug of learnableSlugs) {
        try {
          const caps = await base44.asServiceRole.entities.PluginCapability.filter({ plugin_slug: slug }, 'created_date', 5);
          if (caps.length >= 5) mapped++;
        } catch (e) {
          console.error('[get_learning_status] Query failed for', slug, e.message);
        }
      }

      const total = learnableSlugs.length;
      const progress = total > 0 ? Math.round((mapped / total) * 100) : 0;
      const learning_complete = total > 0 && mapped >= total;
      const unmapped = total - mapped;
      const estimated_seconds_remaining = learning_complete ? 0 : unmapped * 45;
      const current_step = total === 0
        ? 'Connecting to your site...'
        : learning_complete
          ? 'Learning complete — FixPilot knows your setup.'
          : 'Learning about your plugins (' + mapped + '/' + total + ')...';

      let setupProfileBuilt = false;
      try {
        const profiles = await base44.asServiceRole.entities.SiteSetupProfile.filter({ domain_id: domain.id });
        setupProfileBuilt = profiles.length > 0;
      } catch {}

      return Response.json({
        success: true,
        total_plugins: total,
        mapped_plugins: mapped,
        progress_pct: progress,
        current_step,
        learning_complete,
        setup_profile_built: setupProfileBuilt,
        estimated_seconds_remaining,
        domain_found: true,
      });
    }

    // ─── ACTION: Research & Propose Fix ───
    if (action === 'research') {
      let { message, site_context, domain_id, domain_fingerprint, site_url, file_urls } = body;

      // 1. Resolve domain — by domain_id (dashboard calls) or by fingerprint (plugin calls)
      let domain;
      if (domain_id) {
        const domains = await base44.asServiceRole.entities.Domain.filter({ id: domain_id });
        domain = domains[0];
      } else if (domain_fingerprint) {
        const domains = await base44.asServiceRole.entities.Domain.filter({ domain_fingerprint });
        domain = domains[0];

        // Auto-register the domain if this is the first time we see it
        if (!domain) {
          const rawUrl = site_url || site_context?.site_url || '';
          const cleanUrl = rawUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
          const ownerEmail = site_context?.owner_email || '';
          domain = await base44.asServiceRole.entities.Domain.create({
            domain_name: cleanUrl || 'unknown-domain',
            domain_fingerprint,
            api_key: site_context?.api_key || '',
            owner_email: ownerEmail || 'plugin-registered',
            owner_name: site_context?.owner_name || '',
            subscription_tier: 'free',
            subscription_status: 'none',
            fix_count_used: 0,
            fix_count_limit: 3,
            wp_version: site_context?.wp_version || '',
            php_version: site_context?.php_version || '',
            active_theme: site_context?.active_theme || '',
            active_plugins: site_context?.active_plugins ? JSON.stringify(site_context.active_plugins) : '',
            last_active: new Date().toISOString(),
          });
          console.log('[research] Auto-registered new domain:', domain.id, domain.domain_name);
          try {
            const scan = await base44.asServiceRole.entities.SiteHealthScan.create({
              domain_id: domain.id,
              domain_name: domain.domain_name,
              scan_date: new Date().toISOString(),
              status: 'scanning',
              progress: 0,
              current_step: 'Auto-scan triggered on first interaction...',
              issues: '[]',
              total_issues: 0,
            });
            base44.functions.invoke('siteHealthScan', { action: 'run', scan_id: scan.id }).catch(() => {});
          } catch (e) {
            console.error('[research] Failed to auto-start scan:', e.message);
          }
        }
      }

      if (!domain) {
        return Response.json({ error: 'Domain not registered — provide domain_id or domain_fingerprint.' }, { status: 404 });
      }

      // Update last_active
      await base44.asServiceRole.entities.Domain.update(domain.id, {
        last_active: new Date().toISOString(),
        wp_version: site_context?.wp_version || domain.wp_version,
        php_version: site_context?.php_version || domain.php_version,
        active_theme: site_context?.active_theme || domain.active_theme,
        active_plugins: site_context?.active_plugins ? JSON.stringify(site_context.active_plugins) : domain.active_plugins,
      });

      // ─── Fetch LIVE site context from plugin (ensures accurate theme name + CSS classes) ───
      if (domain.api_key) {
        const liveContext = await fetchLiveSiteContext(domain);
        if (liveContext) {
          site_context = { ...(site_context || {}), ...liveContext };
          await base44.asServiceRole.entities.Domain.update(domain.id, {
            active_theme: liveContext.active_theme || domain.active_theme,
            active_plugins: liveContext.active_plugins ? JSON.stringify(liveContext.active_plugins) : domain.active_plugins,
            wp_version: liveContext.wp_version || domain.wp_version,
            php_version: liveContext.php_version || domain.php_version,
          });
          console.log('[research] Live context fetched — Theme:', liveContext.active_theme, '| Plugins:', (liveContext.active_plugins || []).length);
        }
      }

      // ─── SETUP INTELLIGENCE: detect builder, fingerprint, query KB ───
      const builderType = detectBuilderType(site_context?.active_plugins, site_context?.active_theme);
      const setupFingerprint = createSetupFingerprint(site_context);

      // ─── Classify request for conditional context injection (saves ~2500 tokens) ───
      const requestType = classifyRequest(message);
      console.log('[research] Request classified as:', requestType);

      // ─── STACK MANIFEST: retrieve stored structural manifest (proactive site mapping) ───
      const stackManifest = await getStackManifest(base44, domain);
      const stackContext = buildStackContext(stackManifest, builderType, requestType);
      console.log('[research] Stack manifest:', stackManifest ? 'available' : 'not available', '| Categories:', stackManifest?.detected_categories?.length || 0, '| Elementor widgets:', stackManifest?.elementor?.homepage_widgets?.length || 0);

      const setupKB = await querySetupKnowledgeBase(base44, setupFingerprint, builderType, domain.id, message);
      await updateSiteSetupProfile(base44, domain, site_context, builderType, setupFingerprint);
      console.log('[research] Setup intelligence — Builder:', builderType, '| Fingerprint:', setupFingerprint, '| KB recipes:', setupKB.matching_recipes.length, '| Past failures:', setupKB.past_failures.length, '| Past successes:', setupKB.past_successes.length);

      // ─── PLUGIN CAPABILITY KB: fetch known endpoints/options for detected plugins ───
      const pluginCaps = await queryPluginCapabilities(base44, site_context?.active_plugins);
      const pluginsNeedingResearch = pluginCaps.pluginsNeedingResearch;
      console.log('[research] Plugin capabilities — known plugins:', Object.keys(pluginCaps.capabilitiesByPlugin).length, '| plugins needing research:', pluginsNeedingResearch.length);
      // Auto-ingest knowledge for any plugins with gaps (runs in the background, doesn't block the fix)
      if (pluginsNeedingResearch.length > 0) {
        base44.functions.invoke('pluginKnowledgeIngester', { action: 'ingest_site_plugins', active_plugins: site_context?.active_plugins || [], active_theme: site_context?.active_theme || '' }).catch(e => console.error('[research] Auto-ingest failed:', e.message));
        console.log('[research] Triggered background knowledge ingestion for', pluginsNeedingResearch.length, 'plugins with gaps');
      }

      // Compact capability summary for the LLM (only high-confidence, official-doc capabilities)
      const capabilityLines = [];
      for (const [slug, caps] of Object.entries(pluginCaps.capabilitiesByPlugin)) {
        const highConf = caps.filter(c => c.confidence >= 0.7).slice(0, 12);
        if (!highConf.length) continue;
        capabilityLines.push(`▼ ${slug}:`);
        for (const c of highConf) {
          capabilityLines.push(`  [${c.type}] ${c.method ? c.method + ' ' : ''}${c.identifier}${c.version_tested ? ' (v' + c.version_tested + ')' : ''} — ${(c.description || '').substring(0, 90)} | FIX: ${(c.fix_guidance || '').substring(0, 100)}`);
        }
      }
      const pluginCapabilityContext = capabilityLines.length > 0
        ? `\nKNOWN PLUGIN CAPABILITIES (use these EXACT endpoints/options — verified against official docs):\n${capabilityLines.join('\n')}\nWhen a fix targets one of these plugins, use the EXACT identifier/method shown. If a capability has a version tag (e.g. "(v8.0+)"), ONLY use it if the client's installed plugin version meets that requirement — the client's versions are listed in the Active plugins above. If the client runs an older version, skip that capability and use generic_option_update or a version-agnostic approach instead. Prefer generic_option_update with the listed option_key, or rest_api_call with the listed route + method.`
        : '\nNo verified plugin capabilities in KB yet for this site — use generic_option_update / rest_api_call based on discovered routes.';

      // ─── Form guidance (only for form requests — saves ~200 tokens) ───
      const formPluginGuidance = (requestType === 'forms') ? buildFormPluginGuidance(site_context?.active_plugins) : '';

      // ─── Plugin capabilities context (only inject for troubleshooting/general) ───
      const showPluginCaps = (requestType === 'troubleshooting' || requestType === 'general');

      // ─── Condensed CSS policy (was 3x duplicated, now single statement) ───
      const cssPolicy = explicitlyForbidsCss(message)
        ? '\nCSS IS FORBIDDEN by the user. Use post_update, post_meta_update, generic_option_update, or rest_api_call only.'
        : '\nCSS INJECTION FORBIDDEN by default (Native-Only policy). Use native pathways first: post_meta_update (Elementor widgets — use widget ID from Widget Map), generic_option_update, rest_api_call, post_update, menu_update, woocommerce_product_update. Only use css_inject if EVERY native pathway is exhausted, with a "css_justification" field explaining why.';

      // Check fix quota
      const used = domain.fix_count_used || 0;
      const limit = domain.fix_count_limit || 3;
      const hasQuota = used < limit;

      // ─── Security query detection: route to dedicated vulnerability analysis ───
      const securityKeywords = ['vulnerability', 'vulnerabilities', 'security scan', 'security check', 'security audit', 'security test', 'hack', 'hacked', 'malware', 'exploit', 'cve', 'outdated plugin', 'outdated', 'insecure', 'compromised', 'infected'];
      const isSecurityQuery = securityKeywords.some(kw => message.toLowerCase().includes(kw));

      if (isSecurityQuery) {
        const ctxPlugins = site_context?.active_plugins || [];
        const ctxWpVersion = site_context?.wp_version || domain.wp_version || '';
        const ctxPhpVersion = site_context?.php_version || domain.php_version || '';
        const ctxTheme = site_context?.active_theme || domain.active_theme || '';

        const vulnRaw = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are a WordPress security expert performing a thorough vulnerability audit. Analyze this WordPress site for known security vulnerabilities, CVEs, and security advisories.

WordPress version: ${ctxWpVersion || 'unknown'}
PHP version: ${ctxPhpVersion || 'unknown'}
Active theme: ${ctxTheme || 'unknown'}
Active plugins: ${JSON.stringify(ctxPlugins)}

For EACH plugin listed, search the web for:
1. Known CVEs and security vulnerabilities for the installed version
2. Whether a newer version is available and what it patches
3. Any active exploits in the wild

Be thorough — check every single plugin. Outdated plugins are a major security risk. Return ALL findings, not just the top few.

IMPORTANT: You must respond with ONLY a valid JSON object (no markdown, no code fences, no text before or after). Use this exact structure:
{"status":"clean"|"warning"|"critical","vulnerabilities":[{"plugin_name":"...","cve_id":"...","severity":"...","recommended_action":"..."}],"summary":"detailed text summary of findings","outdated_plugins":["plugin names with newer versions"]}`,
          add_context_from_internet: true,
          model: 'gemini_3_flash',
        });

        let vulnResponse;
        try {
          const cleaned = typeof vulnRaw === 'string'
            ? vulnRaw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
            : vulnRaw;
          vulnResponse = typeof cleaned === 'string' ? JSON.parse(cleaned) : cleaned;
        } catch (e) {
          console.error('[research] Failed to parse vulnerability scan JSON:', e.message);
          vulnResponse = { status: 'warning', vulnerabilities: [], summary: 'Security scan completed but results could not be parsed. Please try again.', outdated_plugins: [] };
        }

        // Save as a VulnerabilityScan record
        await base44.asServiceRole.entities.VulnerabilityScan.create({
          domain_id: domain.id,
          domain_name: domain.domain_name,
          scan_date: new Date().toISOString(),
          status: vulnResponse.status,
          vulnerabilities_found: (vulnResponse.vulnerabilities || []).length,
          scan_details: vulnResponse.summary,
          vulnerabilities: JSON.stringify(vulnResponse.vulnerabilities || []),
          wp_version: ctxWpVersion || '',
          active_plugins: ctxPlugins ? JSON.stringify(ctxPlugins) : '[]',
          acknowledged: false,
        });

        // Format findings as a detailed chat response
        let vulnContent = `## Security Scan Results\n\n**Status:** ${vulnResponse.status.toUpperCase()}\n\n${vulnResponse.summary}\n`;

        if (vulnResponse.vulnerabilities && vulnResponse.vulnerabilities.length > 0) {
          vulnContent += `\n### Vulnerabilities Found (${vulnResponse.vulnerabilities.length})\n`;
          vulnResponse.vulnerabilities.forEach(v => {
            vulnContent += `\n- **${v.plugin_name}** — ${v.severity ? v.severity.toUpperCase() : 'UNKNOWN'}`;
            if (v.cve_id) vulnContent += ` (${v.cve_id})`;
            vulnContent += `\n  ${v.recommended_action || 'Update to the latest version.'}\n`;
          });
        }

        if (vulnResponse.outdated_plugins && vulnResponse.outdated_plugins.length > 0) {
          vulnContent += `\n### Outdated Plugins (${vulnResponse.outdated_plugins.length})\n`;
          vulnContent += vulnResponse.outdated_plugins.map(p => `- ${p}`).join('\n');
          vulnContent += '\n\nThese outdated plugins should be updated immediately to reduce security risk.';
        }

        return Response.json({
          response_type: 'text',
          content: vulnContent,
          has_quota: hasQuota,
          fixes_used: used,
          fixes_limit: limit,
          tier: domain.subscription_tier,
          security_scan: true,
        });
      }

      // (Fast-track removed — every request now goes through the KB-aware deep research
      //  path so the knowledge base and site setup map are always consulted first.)

      // ─── WooCommerce data (only for woo requests — saves API call + ~400 tokens) ───
      const activePluginsRaw = site_context?.active_plugins || (domain.active_plugins ? (() => { try { return JSON.parse(domain.active_plugins); } catch { return []; } })() : []);
      const hasWooCommerce = Array.isArray(activePluginsRaw) && activePluginsRaw.some(p => {
        const name = typeof p === 'string' ? p.toLowerCase() : (p.name || '').toLowerCase();
        return name.includes('woocommerce');
      });
      let wooCommerceData = null;
      if (requestType === 'woocommerce' && hasWooCommerce) {
        wooCommerceData = await fetchWooCommerceData(domain, message);
      }

      // Discover REST API routes (only for troubleshooting/general — saves ~400 tokens)
      const discoveredRoutes = (requestType === 'troubleshooting' || requestType === 'general')
        ? await discoverSiteRoutes(domain)
        : null;

      // ─── Fetch Elementor widget map (only for visual requests on Elementor sites) ───
      const isElementorRequest = requestType === 'elementor_visual' || requestType === 'theme_settings';
      const elementorWidgetMap = (isElementorRequest && builderType === 'elementor')
        ? await fetchElementorWidgetMap(domain)
        : null;
      const widgetMapContext = elementorWidgetMap ? await buildWidgetMapContext(elementorWidgetMap, base44, message) : '';
      console.log('[research] Elementor widget map:', elementorWidgetMap ? `${elementorWidgetMap.page_count} pages, ${elementorWidgetMap.total_widgets} widgets` : 'skipped (not visual or not Elementor)');

      // 2. Use setup intelligence KB results (already queried — token efficient, builder-filtered)
      const topRecipes = setupKB.matching_recipes;
      const hasStrongRecipeMatch = setupKB.matching_recipes.length > 0 && (setupKB.matching_recipes[0].success_count || 0) > 2;

      // 3. Use InvokeLLM with web search to research the issue
      const pageStructure = site_context?.page_structure || {};
      const cssClasses = pageStructure.css_classes || [];
      const navLinks = pageStructure.nav_links || '';
      const bodyClasses = pageStructure.body_classes || '';

      const siteUrlStr = site_context?.site_url || (domain.domain_name.startsWith('http') ? domain.domain_name : 'https://' + domain.domain_name);
      const themeKey = detectThemeKey(site_context?.active_theme || '');
      const themeInfo = themeKey ? THEME_SELECTOR_MAP[themeKey] : null;
      const showThemeSelectors = (requestType === 'theme_settings' || requestType === 'elementor_visual') && themeInfo;

      const llmPrompt = `You are FixPilot AI, an expert WordPress assistant. Address the user's EXACT request only — no unsolicited analysis, version checking, or advice.

USER REQUEST: "${message}"

SITE: ${siteUrlStr}
WP: ${site_context?.wp_version || 'unknown'} | PHP: ${site_context?.php_version || 'unknown'} | Theme: ${site_context?.active_theme || 'unknown'} | Builder: ${builderType}
Plugins: ${site_context?.active_plugins ? JSON.stringify(site_context.active_plugins.map(p => typeof p === 'string' ? p : (p.name || ''))) : 'none'}
${cssClasses.length > 0 ? `CSS classes: ${cssClasses.slice(0, 40).join(', ')}` : ''}
${navLinks ? `Nav: ${navLinks.substring(0, 200)}` : ''}
${bodyClasses ? `Body classes: ${bodyClasses}` : ''}
${stackContext}
${widgetMapContext}
${wooCommerceData ? `\nWOOCOMMERCE: ${wooCommerceData.total_count} products, ${wooCommerceData.categories ? wooCommerceData.categories.length : 0} categories\nProducts: ${JSON.stringify(wooCommerceData.products.slice(0, 20))}\nFor price changes, use "woocommerce_product_update". List products as Markdown table: Product | Regular Price | Sale Price | Stock Status | Category.` : ''}
${file_urls && file_urls.length > 0 ? `\nUploaded images (use EXACT URLs, no placeholders): ${file_urls.join(', ')}` : ''}
${formPluginGuidance}
${showPluginCaps && pluginCapabilityContext.trim() ? pluginCapabilityContext : ''}
${discoveredRoutes ? `\nREST ROUTES (${discoveredRoutes.total_routes} total, showing ${discoveredRoutes.routes.length}):\n${JSON.stringify(discoveredRoutes.routes.slice(0, 30).map(r => ({route: r.route, methods: r.methods})))}\nUse "rest_api_call" with route as target, value=JSON {"method":"GET|POST|PUT","params":{...}}.` : ''}
${setupKB.past_successes.length > 0 ? `\nPAST SUCCESSES (reuse): ${JSON.stringify(setupKB.past_successes)}` : ''}
${setupKB.past_failures.length > 0 ? `\nPAST FAILURES (do NOT repeat): ${JSON.stringify(setupKB.past_failures)}` : ''}
${topRecipes.length > 0 ? `\nVERIFIED RECIPES: ${JSON.stringify(topRecipes.map(r => ({title: r.title, category: r.category, fix_template: r.fix_template ? r.fix_template.substring(0, 200) : '', description: r.description})))}` : ''}
${showThemeSelectors ? `\nTHEME: ${site_context?.active_theme}. Selectors: ${themeInfo.selectors.join(', ')}. Settings: ${themeInfo.settings_hint}.` : ''}
${cssPolicy}

${builderType === 'elementor' ? `ELEMENTOR DECISION TREE (follow this EXACTLY — do not deviate):

CRITICAL RULE: rest_api_call is an ACTION that EXECUTES an API call on the WordPress site. It is NOT for investigation, fetching, or inspecting data. Do NOT use rest_api_call to "fetch widget data" or "get the exact text" before patching. The Widget Map above already contains ALL widget IDs, types, and text content. Go DIRECTLY to the appropriate change type below.

STEP 1 — Can you identify the specific widget ID from the Widget Map above?
  YES → Use post_meta_update. This is the MOST PRECISE method.
        Format: value=JSON {"meta_key":"_elementor_data","meta_value":{"widget_id":"<ID from Widget Map>","updates":{"<property>":"<value>"}}}
        The plugin merges surgically into the existing _elementor_data array — do NOT send the full array.
        Use this for: changing a widget's title text, color setting, typography, alignment, spacing, icon, image URL, or any native Elementor widget property.

STEP 2 — Is the request about styling SPECIFIC WORDS/PHRASES within text (e.g. "make 'We ignite careers' pink", "italicize this sentence", "make these words light blue")?
  YES → Use post_content_patch DIRECTLY. Do NOT add a rest_api_call step first. Do NOT "investigate" first.
        Format: value=JSON {"search":"exact text to find from the Widget Map","replace":"<span style=\\"color: lightblue; font-style: italic;\\">exact text</span>"}
        The plugin automatically patches _elementor_data on Elementor pages (structured tree walk), or post_content on non-Elementor pages.
        The structured tree walk decodes the JSON, finds the text in widget settings, replaces it, and re-encodes — this is safe and does not corrupt layouts.
        Use the EXACT text from the Widget Map "Settings" column as the "search" value.
        When wrapping specific words, include enough surrounding context in "search" to match uniquely, and only wrap the target words in the span.

STEP 3 — Is the request about a GLOBAL/site-wide setting (e.g. "change the site's primary color", "change global heading font")?
  YES → Use generic_option_update with the appropriate Elementor option key (e.g. elementor_active_kit for global colors).

STEP 4 — Is the page NOT an Elementor page (marked [NOT Elementor] in the Widget Map)?
  YES → Use post_content_patch (auto-falls back to post_content) or post_update for full content replacement.

NEVER use post_update on an Elementor page — it overwrites post_content which Elementor ignores, and can corrupt the page.
NEVER use rest_api_call as a pre-step for investigation — it executes on the site, it does not fetch data for you.
NEVER use css_inject unless ALL of the above steps are impossible, and include a "css_justification" field explaining why.
` : `BUILDER FIX STRATEGY: Use ${BUILDER_PREFERENCE_MAP[builderType]?.preferred_changes?.join(', ') || 'option_update, generic_option_update'} first. ${BUILDER_PREFERENCE_MAP[builderType]?.guidance || ''}
`}

TARGETING: Use page slug (e.g. "contact-us") or numeric post ID — not "path:/contact-us/".

Respond with ONLY a JSON object (no markdown, no code fences):
{"response_type":"text"|"fix_proposal","no_native_pathway":true|false,"content":"Plain English explanation","recipe_used":"","fix_plan":{"description":"...","category":"css"|"settings"|"content"|"database"|"other","reasoning":"...","changes":[{"change_type":"css_inject"|"option_update"|"post_update"|"post_meta_update"|"post_content_patch"|"menu_update"|"widget_update"|"woocommerce_product_update"|"rest_api_call"|"generic_option_update","target":"...","value":"...","explanation":"...","css_justification":"only for css_inject"}],"verification_plan":[{"check_type":"css_present"|"content_present"|"url_accessible"|"option_confirmed"|"manual_check"|"db_state_check"|"screenshot_compare"|"rest_api_verify","description":"...","expected":"...","check_url":"FULL URL with https://","search_string":"unique substring for css/content checks","target":"for db_state_check: option name (generic_option_update), page slug (post_meta_update/post_content_patch), or ids:123,456"}],"search_string":"for db_state_check: target_type — use 'option' for wp_options, 'post_content' for non-Elementor pages, 'elementor_data' for Elementor page widget settings, 'post_meta' for specific meta keys"}]}}

CHANGE TYPE FORMATS:
- post_content_patch: target=page slug/ID, value=JSON {"search":"exact text to find","replace":"<span style=\\"color: pink !important;\\">exact text</span>"} — Universal search-and-replace. Auto-detects Elementor pages and patches _elementor_data widget settings, or patches post_content for non-Elementor pages. Use for STEP 2 of the decision tree (styling specific words/phrases) and for non-Elementor page content changes.
- post_meta_update: target=page slug/ID, value=JSON {"meta_key":"_elementor_data","meta_value":{"widget_id":"<id from Widget Map>","updates":{"<prop>":"<value>"}}} — STEP 1 of the decision tree. Use when you have a specific widget ID and are changing a native widget property (title, color, font, alignment, etc.). Plugin merges surgically — do NOT send full array.
- generic_option_update: target=option name, value=new value
- rest_api_call: target=route, value=JSON {"method":"GET|POST|PUT","params":{...}}
- woocommerce_product_update: target=category slug or "ids:123,456", value=JSON {"action":"sale|remove_sale","discount_amount":N,"discount_type":"fixed|percentage","sale_price_dates_from":"YYYY-MM-DD","sale_price_dates_to":"YYYY-MM-DD"}
- post_update: target=page slug/ID, value=new content
- menu_update: target=menu item label, value=new label

VERIFICATION: screenshot_compare is MANDATORY for ALL visual, content, and WooCommerce fixes (color, font, layout, text changes, price changes, product updates). You MUST include a screenshot_compare check as the FIRST verification step for any fix that changes something visible on the page. Also include db_state_check for option/post/woo changes (bypasses cache — for Elementor pages use search_string="elementor_data" with target=page slug to verify _elementor_data was updated). rest_api_verify for API changes. check_url must be FULL URL with https://. Include 2-3 checks. If the fix is visual/content/woocommerce and you do NOT include screenshot_compare, the verification will be marked as incomplete.`;

      // Gemini doesn't support response_json_schema with web search enabled,
      // so we ask for JSON as plain text and parse it ourselves.
      const llmRaw = await base44.integrations.Core.InvokeLLM({
        prompt: llmPrompt + '\n\nRespond with ONLY the JSON object above — no markdown, no code fences, no text before or after.',
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        file_urls: file_urls || undefined,
      });

      let llmResponse;
      try {
        const cleaned = typeof llmRaw === 'string'
          ? llmRaw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
          : llmRaw;
        llmResponse = typeof cleaned === 'string' ? JSON.parse(cleaned) : cleaned;
      } catch (e) {
        console.error('[research] Failed to parse LLM JSON response:', e.message);
        llmResponse = { response_type: 'text', content: 'I researched your issue but encountered a formatting error. Please try again.', recipe_used: '', fix_plan: null };
      }

      // Attach quota info
      llmResponse.has_quota = hasQuota;
      llmResponse.fixes_used = used;
      llmResponse.fixes_limit = limit;
      llmResponse.tier = domain.subscription_tier;
      llmResponse.recipe_matched = hasStrongRecipeMatch;
      llmResponse.recipe_name = topRecipes.length > 0 ? topRecipes[0].title : '';

      return Response.json(llmResponse);
    }

    // ─── ACTION: Confirm & Execute Fix ───
    if (action === 'execute_fix') {
      const {
        domain_id,
        domain_fingerprint,
        domain_name,
        user_email,
        fix_description,
        fix_category,
        json_instruction,
        before_state,
        wp_version,
        plugin_versions,
        recipe_id,
        verification_plan,
      } = body;

      // Resolve domain by id (dashboard) or fingerprint (plugin)
      let domain;
      if (domain_id) {
        const domains = await base44.asServiceRole.entities.Domain.filter({ id: domain_id });
        domain = domains[0];
      } else if (domain_fingerprint) {
        const domains = await base44.asServiceRole.entities.Domain.filter({ domain_fingerprint });
        domain = domains[0];
      }

      if (!domain) {
        return Response.json({ error: 'Domain not found' }, { status: 404 });
      }
      if ((domain.fix_count_used || 0) >= (domain.fix_count_limit || 3)) {
        return Response.json({ error: 'Fix quota exhausted' }, { status: 403 });
      }

      // If dashboard call (has domain_id but no domain_fingerprint from plugin),
      // apply the fix via the plugin's REST API first
      let appliedBeforeState = before_state || '{}';
      let pluginApplied = false;

      if (domain.api_key && !domain_fingerprint) {
        const fixId = 'fix_' + Date.now();
        const pluginUrl = `https://${domain.domain_name}/wp-json/fixpilot/v1/apply`;
        try {
          let instructionObj;
          try { instructionObj = JSON.parse(json_instruction || '{}'); } catch { instructionObj = { changes: [] }; }

          const pluginResponse = await fetch(pluginUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-fixpilot-key': domain.api_key,
            },
            body: JSON.stringify({
              fix_id: fixId,
              fix_description: fix_description,
              json_instruction: instructionObj,
            }),
            signal: AbortSignal.timeout(30000),
          });

          if (!pluginResponse.ok) {
            const errText = await pluginResponse.text().catch(() => '');
            return Response.json({ error: `Plugin apply failed: HTTP ${pluginResponse.status} — ${errText.substring(0, 200)}` }, { status: 502 });
          }

          const pluginData = await pluginResponse.json();
          if (pluginData.before_state) {
            appliedBeforeState = JSON.stringify(pluginData.before_state);
          }
          pluginApplied = true;
          console.log('[execute_fix] Plugin applied fix successfully for domain:', domain.domain_name);
        } catch (e) {
          console.error('[execute_fix] Plugin REST API error:', e.message);
          return Response.json({ error: `Could not reach the WordPress plugin at ${pluginUrl}: ${e.message}. Ensure the FixPilot plugin is installed and the site is accessible.` }, { status: 502 });
        }
      }

      // Log the fix execution
      const fix = await base44.asServiceRole.entities.FixExecution.create({
        domain_id: domain.id,
        domain_name: domain_name || domain.domain_name,
        user_email: user_email || domain.owner_email,
        fix_description,
        fix_category: fix_category || 'other',
        json_instruction,
        before_state: appliedBeforeState,
        after_state: json_instruction,
        status: 'applied',
        verification_status: 'pending',
        verification_plan: verification_plan || '',
        wp_version,
        plugin_versions,
        recipe_id: recipe_id || null,
        setup_fingerprint: createSetupFingerprint({ active_theme: domain.active_theme, active_plugins: (() => { try { return JSON.parse(domain.active_plugins || '[]'); } catch { return []; } })(), wp_version: wp_version || domain.wp_version }),
        builder_type: detectBuilderType((() => { try { return JSON.parse(domain.active_plugins || '[]'); } catch { return []; } })(), domain.active_theme),
        change_types_used: (() => { try { const inst = JSON.parse(json_instruction || '{}'); return JSON.stringify((inst.changes || []).map(c => c.change_type || '')); } catch { return '[]'; } })(),
        theme_name: domain.active_theme || '',
      });

      // Increment domain fix count
      await base44.asServiceRole.entities.Domain.update(domain.id, {
        fix_count_used: (domain.fix_count_used || 0) + 1,
      });

      // If based on a recipe, increment its stats
      if (recipe_id) {
        const recipes = await base44.asServiceRole.entities.FixRecipe.filter({ id: recipe_id });
        if (recipes[0]) {
          await base44.asServiceRole.entities.FixRecipe.update(recipe_id, {
            success_count: (recipes[0].success_count || 0) + 1,
            total_count: (recipes[0].total_count || 0) + 1,
          });
        }
      }

      return Response.json({
        success: true,
        fix_id: fix.id,
        remaining_fixes: (domain.fix_count_limit || 3) - ((domain.fix_count_used || 0) + 1),
      });
    }

    // ─── ACTION: Rollback Fix ───
    if (action === 'rollback') {
      const { fix_id } = body;

      const fixes = await base44.asServiceRole.entities.FixExecution.filter({ id: fix_id });
      const fix = fixes[0];
      if (!fix) {
        return Response.json({ error: 'Fix not found' }, { status: 404 });
      }
      if (fix.status === 'reverted') {
        return Response.json({ error: 'Fix already reverted' }, { status: 400 });
      }

      // Mark as reverted
      await base44.asServiceRole.entities.FixExecution.update(fix_id, {
        status: 'reverted',
      });

      return Response.json({
        success: true,
        before_state: fix.before_state,
        fix_description: fix.fix_description,
      });
    }

    // ─── ACTION: Save to Knowledge Base ───
    if (action === 'save_recipe') {
      const { title, description, category, fix_template, wp_version_range, plugin_name, tags } = body;

      const recipe = await base44.asServiceRole.entities.FixRecipe.create({
        title,
        description,
        category: category || 'other',
        fix_template,
        wp_version_range: wp_version_range || '',
        plugin_name: plugin_name || '',
        status: 'draft',
        success_count: 1,
        total_count: 1,
        tags: tags || '',
      });

      return Response.json({ success: true, recipe_id: recipe.id });
    }

    // ─── ACTION: Verify Fix (post-fix automated testing) ───
    if (action === 'verify_fix') {
      const { fix_id } = body;

      const fixes = await base44.asServiceRole.entities.FixExecution.filter({ id: fix_id });
      const fix = fixes[0];
      if (!fix) {
        return Response.json({ error: 'Fix not found' }, { status: 404 });
      }

      let verificationPlan = [];
      try {
        verificationPlan = fix.verification_plan ? JSON.parse(fix.verification_plan) : [];
      } catch (e) {
        console.error('[verify_fix] Failed to parse verification_plan:', e.message);
      }

      if (!verificationPlan.length) {
        await base44.asServiceRole.entities.FixExecution.update(fix_id, {
          verification_status: 'skipped',
          verification_result: JSON.stringify([{ check_type: 'manual_check', description: 'No automated verification plan for this fix', expected: 'Manually verify the fix resolved the issue', status: 'manual', details: 'No verification plan was generated' }]),
        });
        return Response.json({ success: true, verification_status: 'skipped', results: [] });
      }

      const siteUrl = fix.domain_name.startsWith('http') ? fix.domain_name : `https://${fix.domain_name}`;
      const domains = await base44.asServiceRole.entities.Domain.filter({ id: fix.domain_id });
      const domain = domains[0];
      // Delay before verification to allow cache purge propagation
      await new Promise(resolve => setTimeout(resolve, 3000));

      const results = [];
      const checkTypesRun = [];

      for (const check of verificationPlan) {
        const result = await runVerificationCheck(check, siteUrl, domain, base44);
        results.push(result);
        checkTypesRun.push(check.check_type || 'manual_check');
      }

      const hasFailed = results.some(r => r.status === 'failed');
      const hasManual = results.some(r => r.status === 'manual');
      const allManual = results.every(r => r.status === 'manual');
      let overall = hasFailed ? 'failed' : (allManual ? 'manual' : (hasManual ? 'manual' : 'passed'));

      // ─── MANDATORY VISUAL VERIFICATION ───
      // For all visual/content/WooCommerce fixes, auto-inject and run a
      // screenshot_compare check if the LLM didn't already include one.
      const visualCategories = ['css', 'content'];
      const isVisualFix = visualCategories.includes(fix.fix_category);
      let fixChangeTypes = [];
      try { fixChangeTypes = JSON.parse(fix.change_types_used || '[]'); } catch {}
      const hasVisualChangeType = fixChangeTypes.some(ct =>
        ['css_inject', 'post_content_patch', 'post_update', 'post_meta_update', 'woocommerce_product_update', 'widget_update'].includes(ct)
      );
      const hasScreenshot = checkTypesRun.includes('screenshot_compare');

      if ((isVisualFix || hasVisualChangeType) && !hasScreenshot) {
        console.log('[verify_fix] Auto-injecting mandatory screenshot_compare for visual fix');
        const screenshotUrl = (verificationPlan.find(c => c.check_url && c.check_url.startsWith('http')) || {}).check_url || siteUrl;
        const injectedCheck = {
          check_type: 'screenshot_compare',
          description: 'Mandatory visual verification (auto-injected for visual/content/WooCommerce fixes)',
          expected: 'The requested change should be visible on the live page',
          check_url: screenshotUrl,
        };
        const screenshotResult = await runVerificationCheck(injectedCheck, siteUrl, domain, base44);
        results.push(screenshotResult);
        checkTypesRun.push('screenshot_compare');
        if (overall === 'passed' && screenshotResult.status === 'failed') {
          overall = 'failed';
        } else if (overall === 'passed' && screenshotResult.status === 'manual') {
          overall = 'manual';
        }
      }

      await base44.asServiceRole.entities.FixExecution.update(fix_id, {
        verification_status: overall,
        verification_result: JSON.stringify(results),
      });

      // ─── RECIPE LEARNING: update KB with success/failure outcomes ───
      try {
        let changeTypes = [];
        try { changeTypes = JSON.parse(fix.change_types_used || '[]'); } catch {}
        const primaryChangeType = changeTypes[0] || fix.fix_category || 'other';

        if (overall === 'passed') {
          // Create or update a recipe from this successful fix
          const existingRecipes = await base44.asServiceRole.entities.FixRecipe.filter({ title: fix.fix_description }, '-created_date', 5);
          if (existingRecipes[0]) {
            const r = existingRecipes[0];
            await base44.asServiceRole.entities.FixRecipe.update(r.id, {
              success_count: (r.success_count || 0) + 1,
              total_count: (r.total_count || 0) + 1,
              status: (r.success_count || 0) >= 2 ? 'verified' : r.status,
              effective_approach: primaryChangeType,
              builder_type: fix.builder_type || r.builder_type || 'unknown',
            });
          } else {
            await base44.asServiceRole.entities.FixRecipe.create({
              title: fix.fix_description.substring(0, 200),
              description: fix.fix_description,
              category: fix.fix_category || 'other',
              fix_template: fix.json_instruction || '',
              status: 'draft',
              success_count: 1,
              failure_count: 0,
              total_count: 1,
              builder_type: fix.builder_type || 'unknown',
              theme_name: fix.theme_name || '',
              setup_tags: JSON.stringify([fix.builder_type || 'unknown', fix.fix_category || 'other']),
              effective_approach: primaryChangeType,
              failed_approaches: '[]',
            });
          }

          // Update SiteSetupProfile success count + effective approaches
          const profiles = await base44.asServiceRole.entities.SiteSetupProfile.filter({ domain_id: fix.domain_id });
          if (profiles[0]) {
            const p = profiles[0];
            let effectiveArr = [];
            try { effectiveArr = JSON.parse(p.effective_approaches || '[]'); } catch {}
            effectiveArr.push({ change_type: primaryChangeType, fix_description: fix.fix_description });
            await base44.asServiceRole.entities.SiteSetupProfile.update(p.id, {
              fixes_successful: (p.fixes_successful || 0) + 1,
              effective_approaches: JSON.stringify(effectiveArr.slice(-10)),
            });
          }
        } else if (overall === 'failed') {
          // Record the failed approach so it's never repeated
          const existingRecipes = await base44.asServiceRole.entities.FixRecipe.filter({ title: fix.fix_description }, '-created_date', 5);
          if (existingRecipes[0]) {
            const r = existingRecipes[0];
            let failedArr = [];
            try { failedArr = JSON.parse(r.failed_approaches || '[]'); } catch {}
            if (!failedArr.includes(primaryChangeType)) failedArr.push(primaryChangeType);
            await base44.asServiceRole.entities.FixRecipe.update(r.id, {
              failure_count: (r.failure_count || 0) + 1,
              total_count: (r.total_count || 0) + 1,
              failed_approaches: JSON.stringify(failedArr),
            });
          }

          // Update SiteSetupProfile failure count + failed approaches
          const profiles = await base44.asServiceRole.entities.SiteSetupProfile.filter({ domain_id: fix.domain_id });
          if (profiles[0]) {
            const p = profiles[0];
            let failedArr = [];
            try { failedArr = JSON.parse(p.failed_approaches || '[]'); } catch {}
            failedArr.push({ change_type: primaryChangeType, fix_description: fix.fix_description, reason: 'verification_failed' });
            await base44.asServiceRole.entities.SiteSetupProfile.update(p.id, {
              fixes_failed: (p.fixes_failed || 0) + 1,
              failed_approaches: JSON.stringify(failedArr.slice(-10)),
            });
          }
        }

        // Always increment attempted count
        const profiles = await base44.asServiceRole.entities.SiteSetupProfile.filter({ domain_id: fix.domain_id });
        if (profiles[0]) {
          const p = profiles[0];
          await base44.asServiceRole.entities.SiteSetupProfile.update(p.id, {
            fixes_attempted: (p.fixes_attempted || 0) + 1,
          });
        }
      } catch (e) {
        console.error('[verify_fix] Recipe learning failed:', e.message);
      }

      console.log('[verify_fix] Verification complete for fix:', fix_id, 'status:', overall);
      return Response.json({ success: true, verification_status: overall, results });
    }

    // ─── ACTION: Deep Think (advanced code analysis) ───
    if (action === 'deep_think') {
      const { message, site_context, domain_id, domain_fingerprint, theme_code, previous_fix } = body;

      let domain;
      if (domain_id) {
        const domains = await base44.asServiceRole.entities.Domain.filter({ id: domain_id });
        domain = domains[0];
      } else if (domain_fingerprint) {
        const domains = await base44.asServiceRole.entities.Domain.filter({ domain_fingerprint });
        domain = domains[0];
      }

      if (!domain) {
        return Response.json({ error: 'Domain not found' }, { status: 404 });
      }

      const deepThinkCost = 2;
      if ((domain.fix_count_used || 0) + deepThinkCost > (domain.fix_count_limit || 3)) {
        return Response.json({ error: 'Insufficient credits for Deep Think (requires 2)' }, { status: 403 });
      }

      // Gather site code — use theme_code from plugin if available, otherwise fetch live page
      let codeContext = '';
      if (theme_code && Object.keys(theme_code).length > 0) {
        codeContext = `Theme file analysis:\n`;
        for (const [filename, content] of Object.entries(theme_code)) {
          codeContext += `\n=== ${filename} ===\n${content}\n`;
        }
      } else {
        const siteUrl = domain.domain_name.startsWith('http') ? domain.domain_name : `https://${domain.domain_name}`;
        try {
          const response = await fetch(siteUrl, {
            headers: { 'User-Agent': 'FixPilot-DeepThink/1.0' },
            redirect: 'follow',
            signal: AbortSignal.timeout(20000),
          });
          if (response.ok) {
            const html = await response.text();
            codeContext = `Live page HTML analysis:\n`;
            const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
            if (headMatch) codeContext += `\n=== HEAD ===\n${headMatch[1].substring(0, 2000)}\n`;
            const bodyClassMatch = html.match(/<body[^>]*class=["']([^"']+)["']/i);
            if (bodyClassMatch) codeContext += `\n=== BODY CLASSES ===\n${bodyClassMatch[1]}\n`;
            const navMatch = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/i);
            if (navMatch) codeContext += `\n=== NAV ===\n${navMatch[1].substring(0, 2000)}\n`;
            const headerMatch = html.match(/<header[^>]*>([\s\S]*?)<\/header>/i);
            if (headerMatch) codeContext += `\n=== HEADER ===\n${headerMatch[1].substring(0, 2000)}\n`;
            const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
            if (mainMatch) codeContext += `\n=== MAIN CONTENT ===\n${mainMatch[1].substring(0, 2000)}\n`;
            const classMatches = [...html.matchAll(/class=["']([^"']+)["']/g)];
            const allClasses = new Set();
            for (const m of classMatches) {
              for (const c of m[1].split(/\s+/)) {
                if (c.trim() && c.length < 50) allClasses.add(c.trim());
              }
            }
            codeContext += `\n=== UNIQUE CSS CLASSES (${allClasses.size} found) ===\n${[...allClasses].slice(0, 100).join(', ')}\n`;
          }
        } catch (e) {
          codeContext = `Could not fetch live page: ${e.message}`;
        }
      }

      const ctxPlugins = site_context?.active_plugins || [];
      const ctxWpVersion = site_context?.wp_version || domain.wp_version || '';
      const ctxTheme = site_context?.active_theme || domain.active_theme || '';
      const dtBuilder = detectBuilderType(ctxPlugins, ctxTheme);
      const dtFingerprint = createSetupFingerprint({ active_theme: ctxTheme, active_plugins: ctxPlugins, wp_version: ctxWpVersion });
      const dtKB = await querySetupKnowledgeBase(base44, dtFingerprint, dtBuilder, domain.id, message);

      const deepThinkPrompt = `You are FixPilot Deep Think, an advanced WordPress code analysis engine. You have been asked to perform a deep analysis of a WordPress site to find a precise fix.

User's original request:
"${message}"

Site configuration:
- WordPress version: ${ctxWpVersion || 'unknown'}
- Active theme: ${ctxTheme || 'unknown'}
- Active plugins: ${JSON.stringify(ctxPlugins)}

${previous_fix ? `Previous fix that was applied but did NOT resolve the issue:\n${previous_fix}\n` : ''}

DEEP THINK KNOWLEDGE BASE (from past fix attempts on this site):
- Detected Page Builder: ${dtBuilder} (${BUILDER_PREFERENCE_MAP[dtBuilder]?.name || dtBuilder})
- Setup Fingerprint: ${dtFingerprint}
${BUILDER_PREFERENCE_MAP[dtBuilder] ? `BUILDER GUIDANCE: ${BUILDER_PREFERENCE_MAP[dtBuilder].guidance}\nPreferred change types: ${BUILDER_PREFERENCE_MAP[dtBuilder].preferred_changes.join(', ')}` : ''}
${dtKB.past_failures.length > 0 ? `\nPAST FAILED APPROACHES (DO NOT repeat — these were tried and did NOT produce visible changes):\n${JSON.stringify(dtKB.past_failures, null, 2)}` : '\nNo past failures recorded for this site.'}
${dtKB.past_successes.length > 0 ? `\nPAST SUCCESSFUL APPROACHES (these worked — use as reference):\n${JSON.stringify(dtKB.past_successes, null, 2)}` : ''}
${dtKB.matching_recipes.length > 0 ? `\nVERIFIED RECIPES from KB for this builder:\n${JSON.stringify(dtKB.matching_recipes, null, 2)}` : ''}
${buildFormPluginGuidance(ctxPlugins)}
${explicitlyForbidsCss(message) ? '\nUSER EXPLICITLY FORBADE CSS/STYLING — do NOT use css_inject. Use post_update, post_meta_update, generic_option_update, or rest_api_call.' : ''}

Actual site code/structure for analysis:
${codeContext}

Your task:
1. Analyze the actual code structure above carefully.
2. Identify the ROOT CAUSE of the issue based on the real code, not assumptions.
3. Propose a PRECISE fix that targets the actual elements, classes, or settings found in the code.
4. css_inject is FORBIDDEN by default (Stage 1 Native-Only policy). Use ${BUILDER_PREFERENCE_MAP[dtBuilder]?.preferred_changes?.join(', ') || 'builder-native settings'} — post_meta_update, generic_option_update, rest_api_call. Only propose css_inject if EVERY native pathway is exhausted AND you include a css_justification field on that change.
5. If the issue is in a theme file, specify exactly which file and what line range needs changing.

CRITICAL REQUIREMENTS:
- You MUST provide a detailed, actionable explanation in "content" — explain what you found in the code, what the root cause is, and why your proposed fix will work.
- You MUST include a complete fix_plan with specific, targeted changes — never leave it empty.
- You MUST include at least one verification_plan check. For ANY visual, content, or WooCommerce change (color, font, layout, text, price, product update), screenshot_compare is MANDATORY as the first verification step.
- css_inject is FORBIDDEN by default (Stage 1 Native-Only policy). You MUST use builder-native change types (${BUILDER_PREFERENCE_MAP[dtBuilder]?.preferred_changes?.join(', ') || 'option_update, generic_option_update'}) — post_meta_update, generic_option_update, rest_api_call. Only propose css_inject if EVERY native pathway is exhausted AND you include a css_justification field. If no native pathway exists, set response_type to "text" with no_native_pathway: true and ask the user for the specific native setting/ID needed.
- If the previous fix failed, explain WHY it failed and how your new approach is different.

Return a fix plan with:
- response_type: "fix_proposal"
- content: detailed explanation of the root cause and why this fix will work where the previous one may have failed
- fix_plan: with description, category, reasoning (referencing actual code findings), changes (precise targets from the code), and verification_plan`;

      let deepThinkResponse = await base44.integrations.Core.InvokeLLM({
        prompt: deepThinkPrompt,
        model: 'claude_sonnet_4_6',
        response_json_schema: {
          type: "object",
          properties: {
            response_type: { type: "string", enum: ["text", "fix_proposal"] },
            content: { type: "string" },
            fix_plan: {
              type: "object",
              properties: {
                description: { type: "string" },
                category: { type: "string", enum: ["css", "settings", "content", "database", "other"] },
                reasoning: { type: "string" },
                changes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      change_type: { type: "string", enum: ["css_inject", "option_update", "post_update", "post_meta_update", "post_content_patch", "menu_update", "widget_update", "woocommerce_product_update", "rest_api_call", "generic_option_update"] },
                      target: { type: "string" },
                      value: { type: "string" },
                      explanation: { type: "string" }
                    }
                  }
                },
                verification_plan: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      check_type: { type: "string", enum: ["css_present", "content_present", "url_accessible", "option_confirmed", "manual_check", "db_state_check", "screenshot_compare", "rest_api_verify"] },
                      target: { type: "string" },
                      description: { type: "string" },
                      expected: { type: "string" },
                      check_url: { type: "string" },
                      search_string: { type: "string" }
                    }
                  }
                }
              }
            }
          },
          required: ["response_type", "content"]
        }
      });

      // ─── Guard: re-prompt if Deep Think returned an empty / "analysis complete" response ───
      const dtHasFixPlan = deepThinkResponse && deepThinkResponse.fix_plan && Array.isArray(deepThinkResponse.fix_plan.changes) && deepThinkResponse.fix_plan.changes.length > 0;
      const dtContentStr = (typeof deepThinkResponse === 'string' ? deepThinkResponse : (deepThinkResponse && deepThinkResponse.content)) || '';
      const dtContentTrimmed = dtContentStr.trim();
      // Broadened guard: catches "analysis complete", "Deep analysis complete", "Deep think analysis complete",
      // "Done", very short non-actionable content, or any "analysis complete" variant without a fix plan.
      const isNonActionable = !dtHasFixPlan || dtContentTrimmed.length < 80 || /(analysis complete|deep think.*complete|^done\.?$|nothing (more )?to (add|do|report|say)|no (further )?action (needed|required|possible))/i.test(dtContentTrimmed);
      if (isNonActionable) {
        console.log('[deep_think] Empty/non-actionable response — re-prompting with stricter constraints');
        deepThinkResponse = await base44.integrations.Core.InvokeLLM({
          prompt: deepThinkPrompt + '\n\nYOUR PREVIOUS RESPONSE WAS EMPTY OR SAID ONLY "analysis complete". THIS IS UNACCEPTABLE. You MUST return a COMPLETE fix_plan with at least one concrete change AND a substantive content explanation describing the root cause. If you genuinely cannot produce an automated fix, set response_type to "text" and in content explain EXACTLY what blocks you and the precise next step the user should take (which form ID, which setting key, which selector).',
          model: 'claude_sonnet_4_6',
          response_json_schema: {
            type: "object",
            properties: {
              response_type: { type: "string", enum: ["text", "fix_proposal"] },
              content: { type: "string" },
              fix_plan: { type: "object", properties: { description: { type: "string" }, changes: { type: "array", items: { type: "object", properties: { change_type: { type: "string" }, target: { type: "string" }, value: { type: "string" }, explanation: { type: "string" } } } } } },
            },
            required: ["response_type", "content"]
          },
        });
      }

      // Deduct 2 credits for deep think
      await base44.asServiceRole.entities.Domain.update(domain.id, {
        fix_count_used: (domain.fix_count_used || 0) + deepThinkCost,
      });

      deepThinkResponse.has_quota = (domain.fix_count_used || 0) + deepThinkCost < (domain.fix_count_limit || 3);
      deepThinkResponse.fixes_used = (domain.fix_count_used || 0) + deepThinkCost;
      deepThinkResponse.fixes_limit = domain.fix_count_limit || 3;
      deepThinkResponse.tier = domain.subscription_tier;
      deepThinkResponse.deep_think = true;

      return Response.json(deepThinkResponse);
    }

    // ─── ACTION: Start Chat Session (plugin chat history) ───
    if (action === 'start_session') {
      const { domain_fingerprint, domain_id, title } = body;
      let domain;
      if (domain_id) { const ds = await base44.asServiceRole.entities.Domain.filter({ id: domain_id }); domain = ds[0]; }
      else if (domain_fingerprint) { const ds = await base44.asServiceRole.entities.Domain.filter({ domain_fingerprint }); domain = ds[0]; }
      if (!domain) return Response.json({ error: 'Domain not found' }, { status: 404 });
      const session = await base44.asServiceRole.entities.ChatSession.create({ domain_id: domain.id, domain_name: domain.domain_name, user_email: domain.owner_email, status: 'active', title: (title || 'New conversation').substring(0, 100) });
      return Response.json({ success: true, session_id: session.id });
    }

    // ─── ACTION: Add Chat Message to Session ───
    if (action === 'add_session_message') {
      const { session_id, role, content, fix_proposal } = body;
      if (!session_id || !role || !content) return Response.json({ error: 'session_id, role, content required' }, { status: 400 });
      await base44.asServiceRole.entities.ChatMessage.create({ session_id, role, content, fix_proposal: fix_proposal || '', fix_status: 'pending' });
      return Response.json({ success: true });
    }

    // ─── ACTION: List Chat Sessions (plugin history) ───
    if (action === 'list_sessions') {
      const { domain_fingerprint, domain_id } = body;
      let domain;
      if (domain_id) { const ds = await base44.asServiceRole.entities.Domain.filter({ id: domain_id }); domain = ds[0]; }
      else if (domain_fingerprint) { const ds = await base44.asServiceRole.entities.Domain.filter({ domain_fingerprint }); domain = ds[0]; }
      if (!domain) return Response.json({ success: true, sessions: [] });
      const sessions = await base44.asServiceRole.entities.ChatSession.filter({ domain_id: domain.id }, '-created_date', 30);
      return Response.json({ success: true, sessions: sessions.map(s => ({ id: s.id, title: s.title || 'Conversation', status: s.status, created_date: s.created_date })) });
    }

    // ─── ACTION: Get Session Messages ───
    if (action === 'get_session_messages') {
      const { session_id } = body;
      if (!session_id) return Response.json({ error: 'session_id required' }, { status: 400 });
      const msgs = await base44.asServiceRole.entities.ChatMessage.filter({ session_id }, 'created_date', 200);
      return Response.json({ success: true, messages: msgs.map(m => ({ role: m.role, content: m.content, fix_proposal: m.fix_proposal || '' })) });
    }

    return Response.json({ error: 'Invalid action. Use: research, execute_fix, verify_fix, rollback, save_recipe, deep_think, start_session, add_session_message, list_sessions, or get_session_messages.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});