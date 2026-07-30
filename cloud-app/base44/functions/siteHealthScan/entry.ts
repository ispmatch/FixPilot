import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function runRuleBasedChecks(plugins, theme, wpVersion, phpVersion) {
  const issues = [];
  const pluginNames = (plugins || []).map(p => {
    const name = typeof p === 'string' ? p : (p.name || '');
    return name.toLowerCase();
  });

  const cachingKeywords = ['wp rocket', 'w3 total cache', 'w3 cache', 'litespeed', 'wp super cache', 'autoptimize', 'cache'];
  const hasCaching = pluginNames.some(p => cachingKeywords.some(c => p.includes(c)));
  if (!hasCaching && pluginNames.length > 0) {
    issues.push({
      title: 'No caching plugin detected',
      category: 'performance',
      severity: 'warning',
      description: 'Your site has no caching plugin active. Pages are generated from scratch on every visit, which significantly slows down load times.',
      fix_description: 'Install and configure a caching plugin like WP Rocket or LiteSpeed Cache to improve page load speed.',
      kb_search_query: 'wordpress caching plugin setup'
    });
  }

  const hasWoo = pluginNames.some(p => p.includes('woocommerce'));
  const hasSMTP = pluginNames.some(p => p.includes('smtp') || p.includes('wp mail'));
  if (hasWoo && !hasSMTP) {
    issues.push({
      title: 'WooCommerce active without SMTP plugin',
      category: 'functionality',
      severity: 'warning',
      description: 'Your store has WooCommerce active but no SMTP plugin configured. Order confirmation and shipping emails are likely not reaching customers.',
      fix_description: 'Install and configure WP Mail SMTP to ensure WooCommerce order emails are delivered reliably.',
      kb_search_query: 'woocommerce smtp email setup'
    });
  }

  if (phpVersion) {
    const phpNum = parseFloat(phpVersion);
    if (phpNum > 0 && phpNum < 8.0) {
      issues.push({
        title: `PHP ${phpVersion} is outdated`,
        category: 'performance',
        severity: 'critical',
        description: `Your server runs PHP ${phpVersion}, which is below the recommended version 8.0+. PHP 7.x receives no security updates and is significantly slower.`,
        fix_description: 'Upgrade your PHP version to 8.1 or higher through your hosting control panel.',
        kb_search_query: 'upgrade php version wordpress hosting'
      });
    }
  }

  if (pluginNames.length > 30) {
    issues.push({
      title: `${pluginNames.length} active plugins detected`,
      category: 'performance',
      severity: 'warning',
      description: `Having ${pluginNames.length} active plugins can slow down your site and increases the risk of conflicts. Consider deactivating plugins you no longer use.`,
      fix_description: 'Review and deactivate unnecessary plugins to reduce server load and potential conflicts.',
      kb_search_query: 'reduce wordpress plugins performance'
    });
  }

  const hasYoast = pluginNames.some(p => p.includes('yoast'));
  const hasRankMath = pluginNames.some(p => p.includes('rank math'));
  if (hasYoast && hasRankMath) {
    issues.push({
      title: 'Two SEO plugins active simultaneously',
      category: 'functionality',
      severity: 'warning',
      description: 'Both Yoast SEO and Rank Math are active. Running two SEO plugins causes metadata conflicts and can harm your search rankings.',
      fix_description: 'Deactivate one of the SEO plugins and configure the remaining one fully.',
      kb_search_query: 'yoast rank math conflict wordpress'
    });
  }

  const cachingPluginsActive = pluginNames.filter(p => cachingKeywords.some(c => p.includes(c)));
  if (cachingPluginsActive.length > 1) {
    issues.push({
      title: 'Multiple caching plugins active',
      category: 'functionality',
      severity: 'critical',
      description: `Multiple caching plugins are active simultaneously. This causes cache conflicts, broken pages, and unpredictable behavior.`,
      fix_description: 'Keep only one caching plugin active and deactivate the others.',
      kb_search_query: 'multiple caching plugins conflict wordpress'
    });
  }

  return issues;
}

function analyzeHtml(html) {
  const issues = [];
  if (!html) return issues;

  if (!html.includes('viewport')) {
    issues.push({
      title: 'Missing viewport meta tag',
      category: 'design',
      severity: 'critical',
      description: 'Your site is missing a viewport meta tag, which means it may not display correctly on mobile devices.',
      fix_description: 'Add a viewport meta tag to your theme header for proper mobile rendering.',
      kb_search_query: 'wordpress viewport meta tag mobile'
    });
  }

  if (!html.includes('rel="icon"') && !html.includes("rel='icon'") && !html.includes('rel="shortcut icon"') && !html.includes('rel="apple-touch-icon"')) {
    issues.push({
      title: 'Missing favicon',
      category: 'design',
      severity: 'warning',
      description: 'No favicon detected. A favicon improves brand recognition and appears in browser tabs and bookmarks.',
      fix_description: 'Add a favicon through Appearance > Customize > Site Identity.',
      kb_search_query: 'add favicon wordpress'
    });
  }

  const imgMatches = [...html.matchAll(/<img[^>]*>/gi)];
  const imgsWithoutAlt = imgMatches.filter(m => !m[0].includes('alt='));
  if (imgsWithoutAlt.length > 2) {
    issues.push({
      title: `${imgsWithoutAlt.length} images missing alt text`,
      category: 'design',
      severity: 'warning',
      description: `${imgsWithoutAlt.length} images on your homepage are missing alt text, which hurts accessibility and SEO.`,
      fix_description: 'Add descriptive alt text to all images in your media library and content.',
      kb_search_query: 'wordpress image alt text accessibility'
    });
  }

  return issues;
}

async function performScan(domain, base44Client, updateProgress) {
  const siteUrl = domain.domain_name.startsWith('http') ? domain.domain_name : `https://${domain.domain_name}`;

  // Step 1: Fetch site context
  if (updateProgress) await updateProgress(10, 'Fetching site context from plugin...');

  let siteContext = null;
  if (domain.api_key) {
    try {
      const ctxResponse = await fetch(`${siteUrl}/wp-json/fixpilot/v1/context`, {
        headers: { 'x-fixpilot-key': domain.api_key },
        signal: AbortSignal.timeout(15000),
      });
      if (ctxResponse.ok) siteContext = await ctxResponse.json();
    } catch (e) {
      console.error('[scan] Failed to fetch context:', e.message);
    }
  }

  const wpVersion = siteContext?.wp_version || domain.wp_version || 'unknown';
  const phpVersion = siteContext?.php_version || domain.php_version || '';
  const activeTheme = siteContext?.active_theme || domain.active_theme || 'unknown';
  let activePlugins = [];
  try {
    activePlugins = siteContext?.active_plugins || (domain.active_plugins ? JSON.parse(domain.active_plugins) : []);
  } catch { activePlugins = []; }

  // Step 2: Rule-based checks
  if (updateProgress) await updateProgress(30, 'Running diagnostic checks...');
  const ruleIssues = runRuleBasedChecks(activePlugins, activeTheme, wpVersion, phpVersion);

  // Step 3: Fetch homepage HTML
  if (updateProgress) await updateProgress(50, 'Analyzing homepage...');
  let htmlIssues = [];
  let httpStatus = 0;
  let responseTime = 0;
  let hasGzip = false;

  try {
    const startTime = Date.now();
    const pageResponse = await fetch(siteUrl, {
      headers: { 'User-Agent': 'FixPilot-HealthScan/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
    responseTime = Date.now() - startTime;
    httpStatus = pageResponse.status;
    const encoding = pageResponse.headers.get('content-encoding') || '';
    hasGzip = encoding.includes('gzip') || encoding.includes('br') || encoding.includes('deflate');

    if (pageResponse.ok) {
      const html = await pageResponse.text();
      htmlIssues = analyzeHtml(html);
    }
  } catch (e) {
    console.error('[scan] Failed to fetch homepage:', e.message);
    htmlIssues = [{
      title: 'Site could not be reached',
      category: 'functionality',
      severity: 'critical',
      description: `FixPilot could not fetch your site homepage: ${e.message}. The site may be down or blocking automated requests.`,
      fix_description: 'Check that your site is online and accessible. If you have a firewall or security plugin, whitelist the FixPilot user agent.',
      kb_search_query: 'wordpress site not accessible'
    }];
  }

  // Step 4: Performance header checks
  if (updateProgress) await updateProgress(70, 'Checking performance headers...');
  const perfIssues = [];

  if (responseTime > 3000) {
    perfIssues.push({
      title: `Slow response time (${(responseTime / 1000).toFixed(1)}s)`,
      category: 'performance',
      severity: 'warning',
      description: `Your homepage takes ${responseTime}ms to respond. Google recommends under 2.5 seconds for good SEO and user experience.`,
      fix_description: 'Optimize your site with caching, image compression, and reducing plugin bloat to improve load times.',
      kb_search_query: 'wordpress slow response time optimization'
    });
  }
  if (!hasGzip && httpStatus > 0) {
    perfIssues.push({
      title: 'Compression not enabled',
      category: 'performance',
      severity: 'warning',
      description: 'Your server is not sending compressed responses (gzip/br). Enabling compression can reduce page size by up to 70%.',
      fix_description: 'Enable gzip compression in your server configuration or caching plugin.',
      kb_search_query: 'enable gzip compression wordpress'
    });
  }

  // Step 5: AI synthesis
  if (updateProgress) await updateProgress(90, 'Synthesizing results with AI...');

  const allRawIssues = [...ruleIssues, ...htmlIssues, ...perfIssues];
  const pluginListStr = activePlugins.map(p => typeof p === 'string' ? p : p.name).join(', ');

  let finalIssues = allRawIssues;
  let summary = `${allRawIssues.length} issues detected across ${new Set(allRawIssues.map(i => i.category)).size} categories.`;

  if (allRawIssues.length > 0) {
    try {
      const llmResult = await base44Client.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are FixPilot's site health analyzer. I've run automated checks on a WordPress site. Review the raw findings and select the 3 MOST IMPACTFUL issues.

Site: ${domain.domain_name}
WordPress: ${wpVersion}
PHP: ${phpVersion || 'unknown'}
Theme: ${activeTheme}
Plugins (${activePlugins.length}): ${pluginListStr}

Homepage HTTP status: ${httpStatus}
Response time: ${responseTime}ms
Gzip enabled: ${hasGzip}

Raw issues found (${allRawIssues.length}):
${JSON.stringify(allRawIssues, null, 2)}

Your task:
1. Select the 3 MOST IMPACTFUL issues the site owner should address.
2. Ensure they span at least 3 different categories (security, performance, functionality, design).
3. If fewer than 3 raw issues exist, return what we have.
4. For each issue, ensure the description and fix_description are clear and actionable.
5. Deduplicate — if two issues overlap (e.g. "no caching" and "slow response"), combine them into one.

Respond with ONLY a JSON object.`,
        response_json_schema: {
          type: "object",
          properties: {
            issues: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  category: { type: "string", enum: ["security", "performance", "functionality", "design"] },
                  severity: { type: "string", enum: ["warning", "critical"] },
                  description: { type: "string" },
                  fix_description: { type: "string" },
                  kb_search_query: { type: "string" }
                }
              }
            },
            summary: { type: "string" }
          },
          required: ["issues", "summary"]
        }
      });

      if (llmResult?.issues && Array.isArray(llmResult.issues) && llmResult.issues.length > 0) {
        finalIssues = llmResult.issues;
        summary = llmResult.summary || summary;
      }
    } catch (e) {
      console.error('[scan] AI synthesis failed, using raw results:', e.message);
    }
  } else {
    summary = 'No issues detected. Your site appears to be in good health.';
  }

  const snapshot = {
    wp_version: wpVersion,
    php_version: phpVersion,
    active_theme: activeTheme,
    active_plugins: activePlugins.map(p => typeof p === 'string' ? p : p.name),
    http_status: httpStatus,
    response_time: responseTime,
    gzip_enabled: hasGzip,
  };

  return { issues: finalIssues, summary, snapshot };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action } = body;

    // ─── ACTION: Start Scan ───
    if (action === 'start') {
      const { domain_id } = body;
      if (!domain_id) {
        return Response.json({ error: 'domain_id is required' }, { status: 400 });
      }

      const domains = await base44.asServiceRole.entities.Domain.filter({ id: domain_id });
      const domain = domains[0];
      if (!domain) {
        return Response.json({ error: 'Domain not found' }, { status: 404 });
      }

      const scan = await base44.asServiceRole.entities.SiteHealthScan.create({
        domain_id: domain.id,
        domain_name: domain.domain_name,
        scan_date: new Date().toISOString(),
        status: 'scanning',
        progress: 0,
        current_step: 'Initializing scan...',
        issues: '[]',
        total_issues: 0,
      });

      return Response.json({ success: true, scan_id: scan.id });
    }

    // ─── ACTION: Run Scan ───
    if (action === 'run') {
      const { scan_id } = body;
      if (!scan_id) {
        return Response.json({ error: 'scan_id is required' }, { status: 400 });
      }

      const scans = await base44.asServiceRole.entities.SiteHealthScan.filter({ id: scan_id });
      const scan = scans[0];
      if (!scan) {
        return Response.json({ error: 'Scan not found' }, { status: 404 });
      }

      const domains = await base44.asServiceRole.entities.Domain.filter({ id: scan.domain_id });
      const domain = domains[0];
      if (!domain) {
        return Response.json({ error: 'Domain not found' }, { status: 404 });
      }

      try {
        const result = await performScan(domain, base44, async (progress, step) => {
          try {
            await base44.asServiceRole.entities.SiteHealthScan.update(scan_id, {
              progress,
              current_step: step,
            });
          } catch (e) {
            console.error('[scan] Progress update failed:', e.message);
          }
        });

        await base44.asServiceRole.entities.SiteHealthScan.update(scan_id, {
          progress: 100,
          status: 'completed',
          current_step: 'Scan complete',
          issues: JSON.stringify(result.issues),
          total_issues: result.issues.length,
          site_snapshot: JSON.stringify(result.snapshot),
        });

        return Response.json({
          success: true,
          scan_id,
          status: 'completed',
          progress: 100,
          issues: result.issues,
          total_issues: result.issues.length,
          summary: result.summary,
        });
      } catch (e) {
        await base44.asServiceRole.entities.SiteHealthScan.update(scan_id, {
          status: 'error',
          current_step: `Error: ${e.message}`,
        });
        return Response.json({ error: e.message }, { status: 500 });
      }
    }

    // ─── ACTION: Get Status ───
    if (action === 'status') {
      const { scan_id } = body;
      if (!scan_id) {
        return Response.json({ error: 'scan_id is required' }, { status: 400 });
      }

      const scans = await base44.asServiceRole.entities.SiteHealthScan.filter({ id: scan_id });
      const scan = scans[0];
      if (!scan) {
        return Response.json({ error: 'Scan not found' }, { status: 404 });
      }

      let issues = [];
      try { issues = JSON.parse(scan.issues || '[]'); } catch {}

      return Response.json({
        success: true,
        scan_id,
        status: scan.status,
        progress: scan.progress,
        current_step: scan.current_step,
        issues,
        total_issues: scan.total_issues,
      });
    }

    // ─── ACTION: Get Latest Scan ───
    if (action === 'get_latest') {
      const { domain_id } = body;
      if (!domain_id) {
        return Response.json({ error: 'domain_id is required' }, { status: 400 });
      }

      const scans = await base44.asServiceRole.entities.SiteHealthScan.filter({ domain_id }, '-scan_date', 1);
      const scan = scans[0];

      if (!scan) {
        return Response.json({ success: true, scan: null });
      }

      let issues = [];
      try { issues = JSON.parse(scan.issues || '[]'); } catch {}

      return Response.json({
        success: true,
        scan: {
          id: scan.id,
          status: scan.status,
          progress: scan.progress,
          current_step: scan.current_step,
          issues,
          total_issues: scan.total_issues,
          scan_date: scan.scan_date,
        }
      });
    }

    // ─── ACTION: Scan All (for automation) ───
    if (action === 'scan_all') {
      const domains = await base44.asServiceRole.entities.Domain.list('-last_active', 500);
      const results = [];

      for (const domain of domains) {
        if (!domain.api_key) {
          results.push({ domain: domain.domain_name, skipped: 'no api key' });
          continue;
        }

        try {
          const scan = await base44.asServiceRole.entities.SiteHealthScan.create({
            domain_id: domain.id,
            domain_name: domain.domain_name,
            scan_date: new Date().toISOString(),
            status: 'scanning',
            progress: 0,
            current_step: 'Automated weekly scan...',
            issues: '[]',
            total_issues: 0,
          });

          const result = await performScan(domain, base44, null);

          await base44.asServiceRole.entities.SiteHealthScan.update(scan.id, {
            progress: 100,
            status: 'completed',
            current_step: 'Scan complete',
            issues: JSON.stringify(result.issues),
            total_issues: result.issues.length,
            site_snapshot: JSON.stringify(result.snapshot),
          });

          results.push({ domain: domain.domain_name, issues: result.issues.length, status: 'completed' });
        } catch (e) {
          console.error(`[scan_all] Failed for ${domain.domain_name}:`, e.message);
          results.push({ domain: domain.domain_name, error: e.message });
        }
      }

      return Response.json({ success: true, scanned: results.length, results });
    }

    return Response.json({ error: 'Invalid action. Use: start, run, status, get_latest, or scan_all.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});