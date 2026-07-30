<?php
if (!defined('ABSPATH')) {
    exit;
}

class FixPilot_Panel {

    public static function init() {
        add_action('admin_footer', [__CLASS__, 'render_panel']);
        add_action('admin_enqueue_scripts', [__CLASS__, 'enqueue_assets']);
    }

    public static function enqueue_assets() {
        wp_enqueue_style('fixpilot-panel', FIXPILOT_PLUGIN_URL . 'assets/css/panel.css', [], FIXPILOT_VERSION);
        wp_enqueue_script('fixpilot-panel', FIXPILOT_PLUGIN_URL . 'assets/js/panel.js', [], FIXPILOT_VERSION, true);
        wp_localize_script('fixpilot-panel', 'FixPilotConfig', [
            'api_key' => fixpilot_get_api_key(),
            'cloud_url' => fixpilot_get_cloud_url(),
            'fingerprint' => fixpilot_get_fingerprint(),
            'rest_url' => rest_url('fixpilot/v1/'),
            'nonce' => wp_create_nonce('wp_rest'),
            'site_url' => home_url(),
        ]);
    }

    public static function render_panel() {
        ?>
        <div id="fixpilot-panel" class="fixpilot-panel">
            <div class="fixpilot-panel-header">
                <div class="fixpilot-panel-title">
                    <img src="https://media.base44.com/images/public/6a42567182c58083937d0c43/7b98fd004_FixPilotIcon.png" alt="FixPilot" class="fixpilot-panel-logo-icon" />
                    <span class="fixpilot-logo">FixPilot</span>
                    <span class="fixpilot-status">AI Online</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <button class="fixpilot-history-btn" onclick="fixpilotOpenHistory()" title="Chat history">&#9776;</button>
                    <button class="fixpilot-close" onclick="fixpilotToggle()">&times;</button>
                </div>
            </div>
            <div class="fixpilot-messages" id="fixpilot-messages">
                <div class="fixpilot-msg-ai">Hi! I'm FixPilot AI. Describe a WordPress issue and I'll research the best fix, confirm it with you, then apply it safely.</div>
            </div>
            <div id="fixpilot-history" class="fixpilot-history" style="display:none;">
                <div class="fixpilot-history-header">
                    <span>Chat History</span>
                    <div style="display:flex;gap:6px;">
                        <button class="fixpilot-history-back" onclick="fixpilotStartNewChat()">+ New</button>
                        <button class="fixpilot-history-back" onclick="fixpilotCloseHistory()">Back</button>
                    </div>
                </div>
                <div id="fixpilot-history-list" class="fixpilot-history-list"></div>
            </div>
            <div class="fixpilot-input-area">
                <input type="file" id="fixpilot-image-input" accept="image/*,.pdf,.doc,.docx,.txt,.csv,.json,.zip" style="display:none" onchange="fixpilotHandleFileSelect(this)" />
                <button class="fixpilot-upload-btn" onclick="document.getElementById('fixpilot-image-input').click()">+</button>
                <textarea id="fixpilot-input" rows="3" placeholder="Describe an issue... (Shift+Enter for new line)"></textarea>
                <button id="fixpilot-send" onclick="fixpilotSend()">Send</button>
            </div>
            <div id="fixpilot-image-previews" style="display:none;flex-wrap:wrap;gap:6px;padding:0 16px 8px;"></div>
        </div>
        <button id="fixpilot-toggle-btn" class="fixpilot-toggle-btn" onclick="fixpilotToggle()">
            <img src="https://media.base44.com/images/public/6a42567182c58083937d0c43/7b98fd004_FixPilotIcon.png" alt="FixPilot" class="fixpilot-toggle-icon" />
        </button>
        <?php
    }
}