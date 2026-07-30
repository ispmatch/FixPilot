import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action } = body;

    // ─── Create Staging Environment ───
    if (action === 'create_staging') {
      const { domain_id, domain_name, fix_description, fix_execution_id, json_instruction, fix_category } = body;

      const previewToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Generate staging config summary via LLM
      let stagingConfig = json_instruction || '';
      try {
        const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are staging a WordPress fix for preview. Summarize what this fix will do and what the user should check in the staging preview.

Fix description: ${fix_description}
Fix JSON instruction: ${json_instruction || 'N/A'}

Return a brief summary of what to verify in staging (2-3 sentences).`,
          response_json_schema: {
            type: "object",
            properties: {
              staging_notes: { type: "string" }
            },
            required: ["staging_notes"]
          }
        });
        stagingConfig = JSON.stringify({ json_instruction, staging_notes: llmResponse.staging_notes });
      } catch (e) {
        console.error('[staging] LLM summary failed:', e.message);
      }

      const stagedFix = await base44.asServiceRole.entities.StagedFix.create({
        domain_id: domain_id || '',
        domain_name,
        fix_execution_id: fix_execution_id || '',
        fix_description,
        staging_url: '/staged-fixes?token=' + previewToken,
        preview_token: previewToken,
        status: 'ready',
        staging_config: stagingConfig,
        expires_at: expiresAt,
        merged_to_live: false,
      });

      return Response.json({
        success: true,
        staged_fix_id: stagedFix.id,
        preview_token: previewToken,
        staging_url: stagedFix.staging_url,
        expires_at: expiresAt,
      });
    }

    // ─── Approve Staging ───
    if (action === 'approve') {
      const { staged_fix_id } = body;
      await base44.asServiceRole.entities.StagedFix.update(staged_fix_id, {
        status: 'approved',
      });
      return Response.json({ success: true });
    }

    // ─── Reject Staging ───
    if (action === 'reject') {
      const { staged_fix_id } = body;
      await base44.asServiceRole.entities.StagedFix.update(staged_fix_id, {
        status: 'rejected',
      });
      return Response.json({ success: true });
    }

    // ─── Merge to Live ───
    if (action === 'merge') {
      const { staged_fix_id } = body;
      const stagedFixes = await base44.asServiceRole.entities.StagedFix.filter({ id: staged_fix_id });
      const stagedFix = stagedFixes[0];
      if (!stagedFix) return Response.json({ error: 'Staged fix not found' }, { status: 404 });

      await base44.asServiceRole.entities.StagedFix.update(staged_fix_id, {
        status: 'approved',
        merged_to_live: true,
      });

      return Response.json({ success: true, message: 'Fix merged to live. The plugin will apply the changes on the next sync.' });
    }

    return Response.json({ error: 'Invalid action. Use: create_staging, approve, reject, or merge.' }, { status: 400 });
  } catch (error) {
    console.error('[staging] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});