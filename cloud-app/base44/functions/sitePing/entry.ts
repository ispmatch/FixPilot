import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

async function pingSite(domainName) {
  const cleanDomain = domainName.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const url = `https://${cleanDomain}`;
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'WPBugFix-Ping/1.0 (+https://wpbugfix.net)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    const responseTime = Date.now() - startTime;
    const server = response.headers.get('server') || '';
    const poweredBy = response.headers.get('x-powered-by') || '';

    let isWordPress = false;
    let wpVersion = '';
    try {
      const html = await response.text();
      isWordPress = html.includes('wp-content') || html.includes('wp-includes') || html.includes('wordpress');
      const genMatch = html.match(/<meta\s+name=["']generator["']\s+content=["']WordPress\s+([\d.]+)["']/i);
      if (genMatch) wpVersion = genMatch[1];
    } catch {}

    const sslValid = true; // We got here via https

    let status = 'online';
    if (response.status >= 500) status = 'error';
    else if (response.status >= 400) status = 'warning';
    else if (!isWordPress) status = 'not_wordpress';

    return {
      domain_name: cleanDomain,
      status,
      status_code: response.status,
      response_time_ms: responseTime,
      server,
      powered_by: poweredBy,
      is_wordpress: isWordPress,
      wp_version: wpVersion,
      ssl_valid: sslValid,
    };
  } catch (e) {
    const responseTime = Date.now() - startTime;
    let status = 'offline';
    if (e.name === 'TimeoutError' || e.message.includes('timeout')) status = 'timeout';

    // Try http fallback
    try {
      const httpUrl = `http://${cleanDomain}`;
      const httpStart = Date.now();
      const httpResponse = await fetch(httpUrl, {
        headers: { 'User-Agent': 'WPBugFix-Ping/1.0 (+https://wpbugfix.net)' },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });
      const httpTime = Date.now() - httpStart;
      return {
        domain_name: cleanDomain,
        status: httpResponse.ok ? 'online' : 'warning',
        status_code: httpResponse.status,
        response_time_ms: httpTime,
        server: httpResponse.headers.get('server') || '',
        is_wordpress: false,
        wp_version: '',
        ssl_valid: false,
        note: 'HTTPS failed, site accessible via HTTP only (no SSL)',
      };
    } catch {}

    return {
      domain_name: cleanDomain,
      status,
      status_code: 0,
      response_time_ms: responseTime,
      server: '',
      is_wordpress: false,
      wp_version: '',
      ssl_valid: false,
      error: e.message,
    };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ─── Ping a single domain (any domain name) ───
    if (action === 'ping' || !action) {
      const { domain_name } = body;
      if (!domain_name) return Response.json({ error: 'domain_name is required' }, { status: 400 });

      const result = await pingSite(domain_name);
      return Response.json({ success: true, ...result });
    }

    // ─── Ping all registered domains ───
    if (action === 'ping_all') {
      const domains = await base44.asServiceRole.entities.Domain.list('-created_date', 100);
      const results = [];

      for (const domain of domains) {
        const result = await pingSite(domain.domain_name);
        results.push({ domain_name: domain.domain_name, domain_id: domain.id, ...result });
      }

      return Response.json({ success: true, results });
    }

    return Response.json({ error: 'Invalid action. Use: ping or ping_all.' }, { status: 400 });
  } catch (error) {
    console.error('[sitePing] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});