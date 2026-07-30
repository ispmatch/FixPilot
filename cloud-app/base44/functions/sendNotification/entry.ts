import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

async function sendSlackMessage(webhookUrl, text, details) {
  const payload = {
    text,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: 'WPBugFix Alert' } },
      { type: 'section', text: { type: 'mrkdwn', text } },
    ],
  };
  if (details) {
    payload.blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Domain:* ${details.domain_name}\n*Fix:* ${details.fix_description}` },
    });
  }
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Slack webhook failed: HTTP ${res.status}`);
}

async function sendDiscordMessage(webhookUrl, text, details) {
  const payload = {
    content: text,
    embeds: details ? [{
      title: 'WPBugFix Alert',
      fields: [
        { name: 'Domain', value: details.domain_name, inline: true },
        { name: 'Fix', value: details.fix_description.substring(0, 200), inline: false },
      ],
      color: 168,
    }] : [],
  };
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Discord webhook failed: HTTP ${res.status}`);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // ─── Direct test notification ───
    if (body.action === 'test') {
      const { channel_id } = body;
      const channels = await base44.asServiceRole.entities.NotificationChannel.filter({ id: channel_id });
      const channel = channels[0];
      if (!channel) return Response.json({ error: 'Channel not found' }, { status: 404 });

      await dispatchNotification(channel, 'fix_applied', {
        domain_name: channel.domain_name,
        fix_description: 'Test notification from WPBugFix',
      });
      await base44.asServiceRole.entities.NotificationChannel.update(channel_id, {
        last_triggered: new Date().toISOString(),
      });
      return Response.json({ success: true, message: 'Test notification sent' });
    }

    // ─── Entity automation payload ───
    const { event, data, changed_fields } = body;

    if (!data || !data.domain_name) {
      return Response.json({ skipped: true, reason: 'No domain in payload' });
    }

    let eventType = null;
    let messageText = '';
    const details = { domain_name: data.domain_name, fix_description: data.fix_description };

    if (event?.type === 'create' && event?.entity_name === 'FixExecution') {
      eventType = 'fix_applied';
      messageText = `🔧 Fix Applied: "${data.fix_description}" on ${data.domain_name}`;
    } else if (event?.type === 'update' && changed_fields?.includes('status') && data.status === 'reverted') {
      eventType = 'fix_reverted';
      messageText = `↩️ Fix Reverted: "${data.fix_description}" on ${data.domain_name}`;
    } else if (event?.type === 'update' && changed_fields?.includes('verification_status')) {
      if (data.verification_status === 'passed') {
        eventType = 'verification_passed';
        messageText = `✅ Verification Passed: "${data.fix_description}" on ${data.domain_name}`;
      } else if (data.verification_status === 'failed') {
        eventType = 'verification_failed';
        messageText = `⚠️ Verification Failed: "${data.fix_description}" on ${data.domain_name} — the fix may need attention.`;
      }
    }

    if (!eventType) {
      return Response.json({ skipped: true, reason: 'No relevant event type' });
    }

    const channels = await base44.asServiceRole.entities.NotificationChannel.filter({
      domain_name: data.domain_name,
      is_active: true,
    });

    let notified = 0;
    for (const channel of channels) {
      let subscribedEvents = [];
      try { subscribedEvents = JSON.parse(channel.events || '[]'); } catch {}
      if (!subscribedEvents.includes(eventType)) continue;

      try {
        await dispatchNotification(channel, eventType, details);
        await base44.asServiceRole.entities.NotificationChannel.update(channel.id, {
          last_triggered: new Date().toISOString(),
        });
        notified++;
      } catch (e) {
        console.error(`[notify] Failed for ${channel.channel_name}:`, e.message);
      }
    }

    return Response.json({ success: true, eventType, channelsNotified: notified });
  } catch (error) {
    console.error('[notify] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function dispatchNotification(channel, eventType, details) {
  const message = `🔔 ${eventType.replace(/_/g, ' ').toUpperCase()}\n${details.domain_name} — ${details.fix_description}`;

  if (channel.channel_type === 'slack') {
    await sendSlackMessage(channel.webhook_url, message, details);
  } else if (channel.channel_type === 'discord') {
    await sendDiscordMessage(channel.webhook_url, message, details);
  } else if (channel.channel_type === 'webhook') {
    await fetch(channel.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: eventType, message, details }),
    });
  } else if (channel.channel_type === 'email') {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: channel.webhook_url,
      subject: `WPBugFix: ${eventType.replace(/_/g, ' ').toUpperCase()}`,
      body: `${message}\n\nFix: ${details.fix_description}\nDomain: ${details.domain_name}`,
    });
  }
}