=== FixPilot ===
Contributors: fixpilot
Tags: ai, wordpress fix, css, debugging, assistant
Requires at least: 5.8
Tested up to: 6.4
Requires PHP: 7.4
Stable tag: 1.4.1
License: GPLv2 or later

AI-powered WordPress assistant that researches, confirms, and applies fixes with rollback support.

== Description ==

FixPilot embeds an AI chat panel in your WordPress admin. Ask it any question about your site, and it will:
- Research the best fix using WordPress.org docs and plugin/theme vendor documentation
- Present a plain-English plan for your confirmation
- Apply the fix safely via structured JSON instructions
- Snapshot the before-state for one-click rollback
- Learn from every fix to build a collective knowledge base

= Pricing =
* Free: 3 lifetime fixes per domain
* Starter: $25/mo for 10 fixes
* Pro: $50/mo for 25 fixes
* Business: $100/mo for 60 fixes

== Installation ==

1. Upload the fixpilot folder to /wp-content/plugins/
2. Activate the plugin through the 'Plugins' menu in WordPress
3. The plugin auto-connects to the FixPilot cloud on first load — no configuration needed
4. Click the FixPilot icon tab on the right side of wp-admin to open the AI panel
5. Start chatting with FixPilot AI

== Frequently Asked Questions ==

= Is it safe? =
Yes. Every fix requires your explicit confirmation. Before-state snapshots are stored locally for rollback.

= What can the AI fix? =
CSS/design adjustments, plugin settings, content edits, wp_options changes, and more.

= How does domain fingerprinting work? =
We hash your domain URL + server IP + install ID to prevent free trial abuse via reinstallation.