import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ─── Report Change (from plugin) ───
    if (action === 'report_change') {
      const { domain_name, domain_id, change_type, description, diff_details, severity } = body;

      const audit = await base44.asServiceRole.entities.SiteAudit.create({
        domain_name,
        domain_id: domain_id || '',
        audit_date: new Date().toISOString(),
        change_type: change_type || 'other',
        description,
        diff_details: diff_details || '',
        detected_by: 'plugin',
        severity: severity || 'info',
        acknowledged: false,
      });

      return Response.json({ success: true, audit_id: audit.id });
    }

    // ─── Scheduled Change Detection ───
    if (action === 'scan_changes' || !action) {
      const domains = await base44.asServiceRole.entities.Domain.list('-created_date', 100);
      const results = [];

      for (const domain of domains) {
        try {
          if (!domain.api_key) {
            results.push({ domain: domain.domain_name, status: 'skipped', reason: 'No API key' });
            continue;
          }

          const contextUrl = `https://${domain.domain_name.replace(/^https?:\/\//, '')}/wp-json/wpbugfix/v1/context`;
          const response = await fetch(contextUrl, {
            headers: { 'x-wpbugfix-key': domain.api_key },
            signal: AbortSignal.timeout(15000),
          });

          if (!response.ok) {
            results.push({ domain: domain.domain_name, status: 'error', reason: `HTTP ${response.status}` });
            continue;
          }

          const currentContext = await response.json();
          const changes = [];

          // Compare WP version
          if (domain.wp_version && currentContext.wp_version && domain.wp_version !== currentContext.wp_version) {
            changes.push({
              change_type: 'core_updated',
              description: `WordPress updated from ${domain.wp_version} to ${currentContext.wp_version}`,
              diff_details: JSON.stringify({ before: domain.wp_version, after: currentContext.wp_version }),
              severity: 'info',
            });
          }

          // Compare theme
          if (domain.active_theme && currentContext.active_theme && domain.active_theme !== currentContext.active_theme) {
            changes.push({
              change_type: 'theme_change',
              description: `Theme changed from ${domain.active_theme} to ${currentContext.active_theme}`,
              diff_details: JSON.stringify({ before: domain.active_theme, after: currentContext.active_theme }),
              severity: 'warning',
            });
          }

          // Compare plugins
          let oldPlugins = [];
          try { oldPlugins = JSON.parse(domain.active_plugins || '[]'); } catch {}
          const newPlugins = currentContext.active_plugins || [];

          for (const newPlugin of newPlugins) {
            const oldPlugin = oldPlugins.find((p) => (typeof p === 'string' ? p : p.name) === newPlugin.name);
            if (!oldPlugin) {
              changes.push({
                change_type: 'plugin_activated',
                description: `Plugin activated: ${newPlugin.name} v${newPlugin.version}`,
                diff_details: JSON.stringify({ plugin: newPlugin.name, version: newPlugin.version }),
                severity: 'info',
              });
            } else if (oldPlugin.version !== newPlugin.version) {
              changes.push({
                change_type: 'plugin_activated',
                description: `Plugin updated: ${newPlugin.name} from v${oldPlugin.version} to v${newPlugin.version}`,
                diff_details: JSON.stringify({ before: oldPlugin, after: newPlugin }),
                severity: 'info',
              });
            }
          }

          for (const oldPlugin of oldPlugins) {
            const oldName = typeof oldPlugin === 'string' ? oldPlugin : oldPlugin.name;
            if (!newPlugins.some((p) => p.name === oldName)) {
              changes.push({
                change_type: 'plugin_deactivated',
                description: `Plugin deactivated: ${oldName}`,
                diff_details: JSON.stringify({ plugin: oldName }),
                severity: 'info',
              });
            }
          }

          for (const change of changes) {
            await base44.asServiceRole.entities.SiteAudit.create({
              domain_id: domain.id,
              domain_name: domain.domain_name,
              audit_date: new Date().toISOString(),
              change_type: change.change_type,
              description: change.description,
              diff_details: change.diff_details,
              detected_by: 'scheduled_scan',
              severity: change.severity,
              acknowledged: false,
            });
          }

          // Update domain with current context
          await base44.asServiceRole.entities.Domain.update(domain.id, {
            wp_version: currentContext.wp_version,
            php_version: currentContext.php_version,
            active_theme: currentContext.active_theme,
            active_plugins: JSON.stringify(currentContext.active_plugins || []),
          });

          results.push({ domain: domain.domain_name, status: 'scanned', changes_detected: changes.length });
        } catch (e) {
          console.error(`[audit] Error scanning ${domain.domain_name}:`, e.message);
          results.push({ domain: domain.domain_name, status: 'error', error: e.message });
        }
      }

      return Response.json({ success: true, results });
    }

    return Response.json({ error: 'Invalid action. Use: report_change or scan_changes.' }, { status: 400 });
  } catch (error) {
    console.error('[audit] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});