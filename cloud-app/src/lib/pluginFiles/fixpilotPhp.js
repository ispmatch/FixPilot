export default {
  name: 'fixpilot.php',
  path: '/',
  language: 'php',
  code: `<?php
/**
 * Plugin Name: FixPilot
 * Plugin URI: https://FixPilot.cloud
 * Description: AI-powered WordPress assistant — research, confirm, and apply fixes with rollback support.
 * Version: 1.7.5
 * Author: FixPilot.cloud
 * License: GPL v2 or later
 * Text Domain: fixpilot
 */

if (!defined('ABSPATH')) {
    exit;
}

define('FIXPILOT_VERSION', '1.7.5');
define('FIXPILOT_DB_VERSION', '1.0');
define('FIXPILOT_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('FIXPILOT_PLUGIN_URL', plugin_dir_url(__FILE__));

// Cloud API URL — set this to your FixPilot Base44 app URL.
// It will not change unless the app is migrated.
define('FIXPILOT_CLOUD_URL', 'https://fixpilot.base44.app');

require_once FIXPILOT_PLUGIN_DIR . 'includes/class-rest-api.php';
require_once FIXPILOT_PLUGIN_DIR . 'includes/class-fix-applier.php';
require_once FIXPILOT_PLUGIN_DIR . 'includes/class-rollback.php';
require_once FIXPILOT_PLUGIN_DIR . 'includes/class-panel.php';

// Allow safe document uploads through the FixPilot chat (PDFs, docs, text, etc.)
add_filter('upload_mimes', function($mimes) {
    $mimes['pdf']  = 'application/pdf';
    $mimes['doc']  = 'application/msword';
    $mimes['docx'] = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    $mimes['txt']  = 'text/plain';
    $mimes['csv']  = 'text/csv';
    $mimes['json'] = 'application/json';
    $mimes['zip']  = 'application/zip';
    return $mimes;
});

register_activation_hook(__FILE__, 'fixpilot_activate');

function fixpilot_activate() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'fixpilot_fixes';
    $charset_collate = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE $table_name (
        id mediumint(9) NOT NULL AUTO_INCREMENT,
        fix_id varchar(255) NOT NULL,
        domain_hash varchar(255) NOT NULL,
        timestamp datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        fix_description text NOT NULL,
        json_instruction longtext NOT NULL,
        before_state longtext NOT NULL,
        status varchar(20) DEFAULT 'applied' NOT NULL,
        rolled_back tinyint(1) DEFAULT 0 NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY fix_id (fix_id)
    ) $charset_collate;";

    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
    update_option('fixpilot_db_version', FIXPILOT_DB_VERSION);

    $install_id = get_option('fixpilot_install_id');
    if (!$install_id) {
        update_option('fixpilot_install_id', wp_generate_password(16, false));
    }
    fixpilot_get_api_key();
}

function fixpilot_get_fingerprint() {
    $url = home_url();
    $ip = isset($_SERVER['SERVER_ADDR']) ? $_SERVER['SERVER_ADDR'] : 'unknown';
    $install_id = get_option('fixpilot_install_id', '');
    return hash('sha256', $url . $ip . $install_id);
}

function fixpilot_get_api_key() {
    $key = get_option('fixpilot_api_key');
    if (!$key) {
        $key = wp_generate_password(32, false);
        update_option('fixpilot_api_key', $key);
    }
    return $key;
}

function fixpilot_get_cloud_url() {
    return FIXPILOT_CLOUD_URL;
}

function fixpilot_admin_init() {
    // Auto-register if not yet registered
    $registered = get_option('fixpilot_registered', false);
    $cloud_url = fixpilot_get_cloud_url();

    if (!$registered && $cloud_url) {
        $admin_email = get_option('admin_email');
        $site_url = home_url();
        $site_name = get_bloginfo('name');
        $fingerprint = fixpilot_get_fingerprint();

        $theme = wp_get_theme();
        $plugins = get_option('active_plugins', []);
        $plugin_data = [];
        foreach ($plugins as $plugin_path) {
            $data = get_plugin_data(WP_PLUGIN_DIR . '/' . $plugin_path);
            $plugin_data[] = [
                'name' => $data['Name'] ?? basename($plugin_path),
                'version' => $data['Version'] ?? 'unknown',
                'path' => $plugin_path,
            ];
        }

        $response = wp_remote_post($cloud_url . '/functions/aiFixOrchestrator', [
            'headers' => ['Content-Type' => 'application/json'],
            'body' => json_encode([
                'action' => 'register_domain',
                'domain_fingerprint' => $fingerprint,
                'site_url' => $site_url,
                'admin_email' => $admin_email,
                'site_name' => $site_name,
                'wp_version' => get_bloginfo('version'),
                'php_version' => phpversion(),
                'active_theme' => $theme->get('Name') . ' ' . $theme->get('Version'),
                'active_plugins' => $plugin_data,
                'api_key' => fixpilot_get_api_key(),
            ]),
            'timeout' => 30,
        ]);

        if (!is_wp_error($response)) {
            $body = json_decode(wp_remote_retrieve_body($response), true);
            if (isset($body['domain_id'])) {
                update_option('fixpilot_registered', true);
                update_option('fixpilot_domain_id', $body['domain_id']);
            }
        }
    }
}
add_action('admin_init', 'fixpilot_admin_init');

// ─── Event-driven ingestion: push newly activated plugins to cloud for knowledge mapping ───
// Replaces the centralized 5-minute cron with a per-activation trigger.
// The cloud function checks its global capability cache first and skips if already mapped.
add_action('activated_plugin', function($plugin_path) {
    $slug = explode('/', $plugin_path)[0];
    $data = get_plugin_data(WP_PLUGIN_DIR . '/' . $plugin_path);
    wp_remote_post(fixpilot_get_cloud_url() . '/functions/pluginKnowledgeIngester', [
        'headers' => ['Content-Type' => 'application/json'],
        'body' => json_encode([
            'action' => 'research_unknown_plugin',
            'plugin_slug' => $slug,
            'plugin_name' => $data['Name'] ?? $slug,
        ]),
        'timeout' => 5,
        'blocking' => false,
    ]);
});

// When theme changes, push the new theme for knowledge mapping
add_action('after_switch_theme', function() {
    $theme = wp_get_theme();
    wp_remote_post(fixpilot_get_cloud_url() . '/functions/pluginKnowledgeIngester', [
        'headers' => ['Content-Type' => 'application/json'],
        'body' => json_encode([
            'action' => 'research_unknown_plugin',
            'plugin_slug' => 'theme-' . sanitize_title($theme->get('Name')),
            'plugin_name' => $theme->get('Name') . ' ' . $theme->get('Version'),
        ]),
        'timeout' => 5,
        'blocking' => false,
    ]);
});

add_action('init', function() {
    FixPilot_REST_API::init();
    FixPilot_Fix_Applier::init();
    FixPilot_Rollback::init();
    FixPilot_Panel::init();
});

add_action('admin_menu', function() {
    add_menu_page(
        'FixPilot',
        'FixPilot',
        'manage_options',
        'fixpilot',
        'fixpilot_settings_page',
        'dashicons-shield',
        80
    );
});

// ─── Remote Plugin Auto-Update ───────────────────────────────────────────
// Checks FixPilot cloud for new versions and shows a native WordPress
// "Update available" notification. No need to uninstall/reinstall —
// WordPress downloads the ZIP and replaces the plugin automatically.

add_filter('pre_set_site_transient_update_plugins', 'fixpilot_check_for_update');
function fixpilot_check_for_update($transient) {
    if (empty($transient->checked)) {
        return $transient;
    }

    $plugin_file = 'fixpilot/fixpilot.php';
    if (!isset($transient->checked[$plugin_file])) {
        return $transient;
    }

    $current_version = $transient->checked[$plugin_file];

    // Cache the cloud response for 12 hours to avoid excessive API calls
    $cache_key = 'fixpilot_update_check';
    $cloud_response = get_transient($cache_key);

    if ($cloud_response === false) {
        $cloud_url = fixpilot_get_cloud_url();
        $response = wp_remote_post($cloud_url . '/functions/pluginUpdateCheck', [
            'headers' => ['Content-Type' => 'application/json'],
            'body' => json_encode([
                'action' => 'check_version',
                'client_version' => $current_version,
            ]),
            'timeout' => 10,
        ]);

        if (!is_wp_error($response)) {
            $body = json_decode(wp_remote_retrieve_body($response), true);
            if (isset($body['version'])) {
                $cloud_response = $body;
                set_transient($cache_key, $cloud_response, 12 * HOUR_IN_SECONDS);
            }
        }
    }

    if ($cloud_response && isset($cloud_response['version']) && version_compare($cloud_response['version'], $current_version, '>')) {
        $transient->response[$plugin_file] = (object) [
            'slug' => 'fixpilot',
            'plugin' => $plugin_file,
            'new_version' => $cloud_response['version'],
            'url' => 'https://fixpilot.cloud',
            'package' => $cloud_response['download_url'],
            'tested' => isset($cloud_response['tested_wp']) ? $cloud_response['tested_wp'] : '6.5',
            'requires' => isset($cloud_response['requires_wp']) ? $cloud_response['requires_wp'] : '5.8',
            'icons' => [],
        ];
    }

    return $transient;
}

// Show plugin info in "View details" popup
add_filter('plugins_api', 'fixpilot_plugin_info', 10, 3);
function fixpilot_plugin_info($result, $action, $args) {
    if ($action !== 'plugin_information' || $args->slug !== 'fixpilot') {
        return $result;
    }

    $cloud_url = fixpilot_get_cloud_url();
    $response = wp_remote_post($cloud_url . '/functions/pluginUpdateCheck', [
        'headers' => ['Content-Type' => 'application/json'],
        'body' => json_encode([
            'action' => 'check_version',
            'client_version' => FIXPILOT_VERSION,
        ]),
        'timeout' => 10,
    ]);

    if (is_wp_error($response)) {
        return $result;
    }

    $body = json_decode(wp_remote_retrieve_body($response), true);
    if (!isset($body['version'])) {
        return $result;
    }

    return (object) [
        'name' => 'FixPilot',
        'slug' => 'fixpilot',
        'version' => $body['version'],
        'author' => '<a href="https://fixpilot.cloud">FixPilot.cloud</a>',
        'homepage' => 'https://fixpilot.cloud',
        'requires' => isset($body['requires_wp']) ? $body['requires_wp'] : '5.8',
        'tested' => isset($body['tested_wp']) ? $body['tested_wp'] : '6.5',
        'downloaded' => 0,
        'last_updated' => date('Y-m-d'),
        'sections' => [
            'description' => '<p>AI-powered WordPress assistant — research, confirm, and apply fixes with rollback support. Automatic site health scanning, vulnerability checks, and Elementor/WooCommerce/native WordPress fix support.</p>',
            'changelog' => '<p>' . nl2br(isset($body['changelog']) ? $body['changelog'] : 'Latest update.') . '</p>',
        ],
        'download_link' => $body['download_url'],
    ];
}

// Force a re-check of updates when the user visits the plugins page.
// Uses load-plugins.php hook (fires before pre_set_site_transient_update_plugins)
// so the stale 12-hour cache is cleared on every plugins page visit.
add_action('load-plugins.php', function() {
    delete_transient('fixpilot_update_check');
});

add_action('admin_enqueue_scripts', function($hook) {
    if ($hook !== 'toplevel_page_fixpilot') {
        return;
    }
    wp_enqueue_style(
        'fixpilot-admin-dashboard',
        FIXPILOT_PLUGIN_URL . 'assets/css/admin-dashboard.css',
        [],
        FIXPILOT_VERSION
    );
    wp_enqueue_script(
        'fixpilot-admin-dashboard',
        FIXPILOT_PLUGIN_URL . 'assets/js/admin-dashboard.js',
        [],
        FIXPILOT_VERSION,
        true
    );
    $theme = wp_get_theme();
    $active_theme = $theme->get('Name') . ' ' . $theme->get('Version');
    $plugins = get_option('active_plugins', []);
    $plugin_data = [];
    foreach ($plugins as $plugin_path) {
        $data = get_plugin_data(WP_PLUGIN_DIR . '/' . $plugin_path);
        $plugin_data[] = [
            'name' => $data['Name'] ?? basename($plugin_path),
            'version' => $data['Version'] ?? 'unknown',
            'path' => $plugin_path,
        ];
    }

    wp_localize_script('fixpilot-admin-dashboard', 'FixPilotAdmin', [
        'cloud_url'      => fixpilot_get_cloud_url(),
        'fingerprint'     => fixpilot_get_fingerprint(),
        'domain_id'       => get_option('fixpilot_domain_id', ''),
        'registered'      => (bool) get_option('fixpilot_registered', false),
        'site_url'        => home_url(),
        'site_name'       => get_bloginfo('name'),
        'admin_email'     => get_option('admin_email'),
        'wp_version'      => get_bloginfo('version'),
        'php_version'     => phpversion(),
        'active_theme'    => $active_theme,
        'active_plugins'  => $plugin_data,
        'api_key'         => fixpilot_get_api_key(),
        'nonce'           => wp_create_nonce('wp_rest'),
        'rest_url'        => rest_url('fixpilot/v1/'),
    ]);
});

function fixpilot_settings_page() {
    $api_key = fixpilot_get_api_key();
    $fingerprint = fixpilot_get_fingerprint();
    $cloud_url = fixpilot_get_cloud_url();
    $registered = get_option('fixpilot_registered', false);
    $domain_id = get_option('fixpilot_domain_id', '');
    $admin_email = get_option('admin_email');
    $site_url = home_url();
    $theme = wp_get_theme();
    $active_theme = $theme->get('Name') . ' ' . $theme->get('Version');
    ?>
    <div class="fixpilot-admin-wrap" id="fixpilot-admin-app">
        <!-- Banner -->
        <div class="fixpilot-admin-banner">
            <img src="https://media.base44.com/images/public/6a42567182c58083937d0c43/7c4614978_FixPilotMainbrandingbanner.png" alt="FixPilot.cloud" class="fixpilot-admin-banner-img" />
        </div>

        <!-- Header -->
        <div class="fixpilot-admin-header">
            <div class="fixpilot-admin-brand">
                <div class="fixpilot-admin-logo">
                    FixPilot
                </div>
                <div class="fixpilot-admin-tagline">AI-Powered WordPress Management · v<?php echo FIXPILOT_VERSION; ?></div>
            </div>
            <div class="fixpilot-admin-connection">
                <?php if ($registered): ?>
                    <span class="fixpilot-status-badge fixpilot-status-connected">&#9679; Connected</span>
                <?php else: ?>
                    <span class="fixpilot-status-badge fixpilot-status-pending">&#9675; Pending</span>
                <?php endif; ?>
            </div>
        </div>

        <!-- Notice area -->
        <div id="fixpilot-notice-area"></div>

        <!-- Tabs -->
        <div class="fixpilot-admin-tabs">
            <button class="fixpilot-tab active" onclick="fixpilotSwitchTab('dashboard')">Dashboard</button>
            <button class="fixpilot-tab" onclick="fixpilotSwitchTab('history')">Fix History</button>
            <button class="fixpilot-tab" onclick="fixpilotSwitchTab('plans')">Plans &amp; Billing</button>
            <button class="fixpilot-tab" onclick="fixpilotSwitchTab('settings')">Settings</button>
        </div>

        <!-- Dashboard Tab -->
        <div class="fixpilot-tab-content active" id="fixpilot-tab-dashboard">
            <div class="fixpilot-stats-grid">
                <div class="fixpilot-stat-card">
                    <div class="fixpilot-stat-label">Plan</div>
                    <div class="fixpilot-stat-value fixpilot-stat-plan" id="fixpilot-stat-plan"><?php echo $registered ? '...' : 'Not connected'; ?></div>
                </div>
                <div class="fixpilot-stat-card">
                    <div class="fixpilot-stat-label">Fixes Used</div>
                    <div class="fixpilot-stat-value" id="fixpilot-stat-fixes"><?php echo $registered ? '...' : '...'; ?></div>
                    <div class="fixpilot-stat-bar">
                        <div class="fixpilot-stat-bar-fill" id="fixpilot-stat-bar" style="width: 0%;"></div>
                    </div>
                </div>
                <div class="fixpilot-stat-card">
                    <div class="fixpilot-stat-label">Subscription</div>
                    <div class="fixpilot-stat-value" id="fixpilot-stat-sub">...</div>
                </div>
                <div class="fixpilot-stat-card">
                    <div class="fixpilot-stat-label">Owner Email</div>
                    <div class="fixpilot-stat-value fixpilot-stat-email"><?php echo esc_html($admin_email); ?></div>
                </div>
            </div>

            <div class="fixpilot-learning-card" id="fixpilot-learning-card" style="display:none;">
                <div class="fixpilot-learning-header">
                    <span class="fixpilot-learning-icon">&#9201;</span>
                    <div>
                        <div class="fixpilot-learning-title">Learning about your site</div>
                        <div class="fixpilot-learning-step" id="fixpilot-learning-step">Connecting to your site...</div>
                    </div>
                </div>
                <div class="fixpilot-learning-bar">
                    <div class="fixpilot-learning-bar-fill" id="fixpilot-learning-bar" style="width:0%;"></div>
                </div>
                <div class="fixpilot-learning-meta" id="fixpilot-learning-meta">0 of 0 plugins mapped</div>
                <div class="fixpilot-learning-eta" id="fixpilot-learning-eta" style="display:none;"></div>
            </div>

            <div class="fixpilot-info-section">
                <h3 class="fixpilot-section-title">Site Information</h3>
                <div class="fixpilot-info-grid">
                    <div class="fixpilot-info-item">
                        <span class="fixpilot-info-label">Site URL</span>
                        <span class="fixpilot-info-value"><?php echo esc_html($site_url); ?></span>
                    </div>
                    <div class="fixpilot-info-item">
                        <span class="fixpilot-info-label">WordPress</span>
                        <span class="fixpilot-info-value"><?php echo esc_html(get_bloginfo('version')); ?></span>
                    </div>
                    <div class="fixpilot-info-item">
                        <span class="fixpilot-info-label">PHP</span>
                        <span class="fixpilot-info-value"><?php echo esc_html(phpversion()); ?></span>
                    </div>
                    <div class="fixpilot-info-item">
                        <span class="fixpilot-info-label">Active Theme</span>
                        <span class="fixpilot-info-value"><?php echo esc_html($active_theme); ?></span>
                    </div>
                </div>
            </div>

            <div class="fixpilot-cta-section">
                <button class="fixpilot-btn fixpilot-btn-primary" onclick="fixpilotSwitchTab('plans')">Upgrade Plan</button>
                <p class="fixpilot-cta-note">Use the "fix" tab on the right edge of any admin page to chat with FixPilot AI.</p>
            </div>
        </div>

        <!-- Fix History Tab -->
        <div class="fixpilot-tab-content" id="fixpilot-tab-history">
            <div id="fixpilot-history-content">
                <p class="fixpilot-loading-text">Loading fix history...</p>
            </div>
        </div>

        <!-- Plans & Billing Tab -->
        <div class="fixpilot-tab-content" id="fixpilot-tab-plans">
            <div id="fixpilot-plans-content"></div>
        </div>

        <!-- Settings Tab -->
        <div class="fixpilot-tab-content" id="fixpilot-tab-settings">
            <div class="fixpilot-settings-form">
                <h3 class="fixpilot-section-title">Connection Details</h3>
                <table class="form-table">
                    <tr>
                        <th scope="row">Plugin Version</th>
                        <td><code class="fixpilot-code">v<?php echo FIXPILOT_VERSION; ?></code></td>
                    </tr>
                    <tr>
                        <th scope="row">Cloud API URL</th>
                        <td><code class="fixpilot-code"><?php echo esc_html(fixpilot_get_cloud_url()); ?></code></td>
                    </tr>
                    <tr>
                        <th scope="row">Domain Fingerprint</th>
                        <td><code class="fixpilot-code"><?php echo esc_html($fingerprint); ?></code></td>
                    </tr>
                    <tr>
                        <th scope="row">API Key</th>
                        <td><code class="fixpilot-code"><?php echo esc_html($api_key); ?></code></td>
                    </tr>
                    <tr>
                        <th scope="row">Registration</th>
                        <td>
                            <?php if ($registered): ?>
                                <span class="fixpilot-status-badge fixpilot-status-connected">Registered</span>
                                <code class="fixpilot-code"><?php echo esc_html($domain_id); ?></code>
                            <?php else: ?>
                                <span class="fixpilot-status-badge fixpilot-status-pending">Auto-registration in progress</span>
                                <p class="fixpilot-input-help">Your site will connect automatically. If this persists, ensure your server can reach the cloud API.</p>
                            <?php endif; ?>
                        </td>
                    </tr>
                </table>
            </div>
        </div>
    </div>
    <?php
}`
};