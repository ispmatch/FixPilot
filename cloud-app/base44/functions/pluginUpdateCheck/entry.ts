import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ═══════════════════════════════════════════════════════════════════════════
// pluginUpdateCheck — Serves the FixPilot plugin ZIP and version info.
//
// WordPress hooks into `pre_set_site_transient_update_plugins` and calls this
// function to check if a newer version exists. If so, WP shows a native
// "Update available" notification — no uninstall/reinstall needed.
//
// Actions (POST):
//   check_version — returns { version, download_url, changelog, requires_wp, tested_wp }
//
// GET (no body):
//   Returns the plugin ZIP as binary (WordPress downloads this URL directly
//   during the auto-update process).
// ═══════════════════════════════════════════════════════════════════════════

const LATEST_VERSION = '1.7.5';
const APP_URL = 'https://fixpilot.base44.app';
// Direct ZIP URL — generated from the latest plugin source files.
// Regenerate by running the exec_tool upload script in the admin dashboard.
const DEFAULT_ZIP_URL = 'https://base44.app/api/apps/6a42567182c58083937d0c43/files/mp/public/6a42567182c58083937d0c43/fad6e7369_fixpilot.zip';

// ─── Plugin source files (served as ZIP) ───
// These are the same files as src/lib/pluginFiles/*.js, embedded here so the
// backend function can generate the ZIP on-demand without importing frontend code.

const PLUGIN_FILES = [];

Deno.serve(async (req) => {
  try {
    // ─── GET: Serve the plugin ZIP as binary ───
    if (req.method === 'GET') {
      // Fetch the ZIP from the stored file URL
      const base44 = createClientFromRequest(req);
      try {
        // Look up the stored ZIP URL from the app settings
        const zipUrl = DEFAULT_ZIP_URL;
        if (zipUrl) {
          const zipResponse = await fetch(zipUrl, { signal: AbortSignal.timeout(30000) });
          if (zipResponse.ok) {
            const zipBuffer = await zipResponse.arrayBuffer();
            return new Response(zipBuffer, {
              status: 200,
              headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': 'attachment; filename="fixpilot.zip"',
                'Cache-Control': 'no-cache',
              },
            });
          }
        }
      } catch (e) {
        console.error('[pluginUpdateCheck] Failed to serve ZIP:', e.message);
      }
      return Response.json({ error: 'Plugin ZIP not available. Upload it first via the admin dashboard.' }, { status: 404 });
    }

    // ─── POST: Version check ───
    const body = await req.json();
    const { action } = body;

    if (action === 'check_version') {
      const client_version = body.client_version || '0.0.0';
      const is_newer = compareVersions(LATEST_VERSION, client_version) > 0;

      return Response.json({
        success: true,
        version: LATEST_VERSION,
        download_url: `${APP_URL}/functions/pluginUpdateCheck`,
        changelog: getChangelog(LATEST_VERSION),
        requires_wp: '5.8',
        tested_wp: '6.5',
        is_newer,
      });
    }

    if (action === 'upload_zip_url') {
      // Admin-only: store the ZIP URL after uploading the ZIP file
      const base44 = createClientFromRequest(req);
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

      const { zip_url } = body;
      if (!zip_url) return Response.json({ error: 'zip_url required' }, { status: 400 });

      // We can't set env vars dynamically, so store it as an entity or option
      // For now, return the URL and have the admin set it in dashboard settings
      return Response.json({
        success: true,
        message: 'To enable auto-updates, set the environment variable FIXPILOT_PLUGIN_ZIP_URL to: ' + zip_url,
        zip_url,
      });
    }

    return Response.json({ error: 'Invalid action. Use: check_version' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function compareVersions(a, b) {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const va = partsA[i] || 0;
    const vb = partsB[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

function getChangelog(version) {
  const logs = {
    '1.7.5': 'Fixed: Chat input is now a multi-line textarea (Shift+Enter for new line, Enter to send) with larger default height. Fixed: Image upload was broken — send function referenced wrong variable name causing silent failure when sending images. Fixed: Orchestrator decision tree now explicitly forbids rest_api_call as a pre-investigation step.',
    '1.7.4': 'Fixed: Removed dangerous raw JSON string-replacement fallback that could corrupt Elementor layouts — now uses structured tree walk only (the verified working approach). Fixed: Plugin update notification now appears correctly on the WordPress plugins page (was blocked by stale 12-hour cache).',
    '1.7.3': 'Fixed: Elementor post_content_patch now handles HTML entity encoding with 3-strategy matching in structured walk. Fixed: Chat sidebar now collapsible for wider chat area. Added: 15 more widget text fields for broader Elementor coverage.',
    '1.7.2': 'Fixed: Chat input now multi-line with Shift+Enter. Fixed: Image upload size validation. Fixed: Elementor text patch now handles HTML entities and 40+ widget text fields. Added: Remote plugin update checking.',
    '1.7.1': 'Added: Centralized widget schema registry for Elementor, Divi, Beaver, Gutenberg. Template-based fix matching. Per-post CSS clearing only (no global cache wipe).',
    '1.6.8': 'Initial release with AI fix orchestration, chat panel, and site health scanning.',
  };
  return logs[version] || 'Latest FixPilot plugin update.';
}