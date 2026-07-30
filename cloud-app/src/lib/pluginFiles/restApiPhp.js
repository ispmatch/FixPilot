export default {
  name: 'class-rest-api.php',
  path: 'includes/',
  language: 'php',
  code: `<?php
if (!defined('ABSPATH')) {
    exit;
}

class FixPilot_REST_API {

    public static function init() {
        add_action('rest_api_init', [__CLASS__, 'register_routes']);
        // Bypass WordPress cookie/nonce auth when FixPilot API key is present — fixes "Cookie check failed"
        add_filter('rest_authentication_errors', function($result) {
            $apiKey = self::extract_fixpilot_key();
            if ($apiKey && hash_equals(fixpilot_get_api_key(), $apiKey)) {
                return true;
            }
            return $result;
        });
    }

    // ─── Robust API key extraction from HTTP headers ───
    // Works on Apache (getallheaders), nginx + PHP-FPM ($_SERVER),
    // and nginx with rewrite redirects (REDIRECT_HTTP_*).
    private static function extract_fixpilot_key() {
        // Method 1: getallheaders() — works on Apache and most PHP-FPM setups
        if (function_exists('getallheaders')) {
            $headers = getallheaders();
            foreach (['x-fixpilot-key', 'X-FixPilot-Key', 'X-FIXPILOT-KEY', 'X-Fixpilot-Key'] as $key) {
                if (!empty($headers[$key])) {
                    return $headers[$key];
                }
            }
        }

        // Method 2: $_SERVER superglobal — works on nginx + PHP-FPM
        // nginx stores custom headers as HTTP_<UPPERCASE_WITH_UNDERSCORES>
        $server_keys = [
            'HTTP_X_FIXPILOT_KEY',
            'REDIRECT_HTTP_X_FIXPILOT_KEY',  // nginx + rewrite rules
        ];
        foreach ($server_keys as $key) {
            if (!empty($_SERVER[$key])) {
                return $_SERVER[$key];
            }
        }

        return '';
    }

    public static function register_routes() {
        register_rest_route('fixpilot/v1', '/apply', [
            'methods'  => 'POST',
            'callback' => [__CLASS__, 'apply_fix'],
            'permission_callback' => [__CLASS__, 'verify_request'],
        ]);

        register_rest_route('fixpilot/v1', '/rollback', [
            'methods'  => 'POST',
            'callback' => [__CLASS__, 'rollback_fix'],
            'permission_callback' => [__CLASS__, 'verify_request'],
        ]);

        register_rest_route('fixpilot/v1', '/context', [
            'methods'  => 'GET',
            'callback' => [__CLASS__, 'get_site_context'],
            'permission_callback' => [__CLASS__, 'verify_request'],
        ]);

        register_rest_route('fixpilot/v1', '/theme-code', [
            'methods'  => 'GET',
            'callback' => [__CLASS__, 'get_theme_code'],
            'permission_callback' => [__CLASS__, 'verify_request'],
        ]);

        register_rest_route('fixpilot/v1', '/upload-media', [
            'methods'  => 'POST',
            'callback' => [__CLASS__, 'upload_media'],
            'permission_callback' => [__CLASS__, 'verify_request'],
        ]);

        register_rest_route('fixpilot/v1', '/products', [
            'methods'  => 'POST',
            'callback' => [__CLASS__, 'get_products'],
            'permission_callback' => [__CLASS__, 'verify_request'],
        ]);

        register_rest_route('fixpilot/v1', '/verify-state', [
            'methods'  => 'POST',
            'callback' => [__CLASS__, 'verify_state'],
            'permission_callback' => [__CLASS__, 'verify_request'],
        ]);

        register_rest_route('fixpilot/v1', '/discover', [
            'methods'  => 'GET',
            'callback' => [__CLASS__, 'discover_routes'],
            'permission_callback' => [__CLASS__, 'verify_request'],
        ]);

        register_rest_route('fixpilot/v1', '/rest-proxy', [
            'methods'  => 'POST',
            'callback' => [__CLASS__, 'rest_proxy'],
            'permission_callback' => [__CLASS__, 'verify_request'],
        ]);

        register_rest_route('fixpilot/v1', '/generic-option', [
            'methods'  => 'POST',
            'callback' => [__CLASS__, 'generic_option'],
            'permission_callback' => [__CLASS__, 'verify_request'],
        ]);

        register_rest_route('fixpilot/v1', '/manifest', [
            'methods'  => 'GET',
            'callback' => [__CLASS__, 'get_site_manifest'],
            'permission_callback' => [__CLASS__, 'verify_request'],
        ]);

        register_rest_route('fixpilot/v1', '/elementor-map', [
            'methods'  => 'POST',
            'callback' => [__CLASS__, 'get_elementor_map'],
            'permission_callback' => [__CLASS__, 'verify_request'],
        ]);
    }

    public static function verify_request($request) {
        // Try the REST request object first (most reliable when it works)
        $api_key = $request->get_header('x-fixpilot-key');

        // Fallback to raw $_SERVER extraction for nginx + PHP-FPM where
        // the REST request object may not see custom headers
        if (!$api_key) {
            $api_key = self::extract_fixpilot_key();
        }

        $stored_key = fixpilot_get_api_key();

        if (!$api_key || !hash_equals($stored_key, $api_key)) {
            return new WP_Error(
                'invalid_key',
                'Invalid or missing API key',
                ['status' => 403]
            );
        }
        return true;
    }

    public static function apply_fix($request) {
        $body = json_decode($request->get_body(), true);

        if (!isset($body['fix_id']) || !isset($body['json_instruction'])) {
            return new WP_Error('missing_data', 'fix_id and json_instruction required', ['status' => 400]);
        }

        $fix_id = sanitize_text_field($body['fix_id']);
        $description = sanitize_text_field($body['fix_description'] ?? 'AI-applied fix');
        $instruction = $body['json_instruction'];

        $before_state = FixPilot_Fix_Applier::apply($instruction, $fix_id);

        if (is_wp_error($before_state)) {
            return $before_state;
        }

        self::log_fix($fix_id, $description, $instruction, $before_state);

        return rest_ensure_response([
            'success' => true,
            'fix_id' => $fix_id,
            'before_state' => $before_state,
        ]);
    }

    public static function rollback_fix($request) {
        $body = json_decode($request->get_body(), true);
        $fix_id = sanitize_text_field($body['fix_id'] ?? '');

        if (!$fix_id) {
            return new WP_Error('missing_fix_id', 'fix_id required', ['status' => 400]);
        }

        $result = FixPilot_Rollback::rollback($fix_id);

        if (is_wp_error($result)) {
            return $result;
        }

        return rest_ensure_response([
            'success' => true,
            'fix_id' => $fix_id,
            'restored_state' => $result,
        ]);
    }

    public static function get_site_context($request) {
        $theme = wp_get_theme();
        $plugins = get_option('active_plugins', []);

        $plugin_data = [];
        foreach ($plugins as $plugin_path) {
            $data = get_plugin_data(WP_PLUGIN_DIR . '/' . $plugin_path);
            $plugin_data[] = [
                'name' => $data['Name'] ?? basename($plugin_path),
                'version' => $data['Version'] ?? 'unknown',
            ];
        }

        $pageStructure = self::extract_page_structure();

        return rest_ensure_response([
            'wp_version' => get_bloginfo('version'),
            'php_version' => phpversion(),
            'active_theme' => $theme->get('Name') . ' ' . $theme->get('Version'),
            'active_plugins' => $plugin_data,
            'current_screen' => get_current_screen() ? get_current_screen()->id : 'unknown',
            'site_url' => home_url(),
            'fingerprint' => fixpilot_get_fingerprint(),
            'api_key' => fixpilot_get_api_key(),
            'page_structure' => $pageStructure,
        ]);
    }

    public static function get_theme_code($request) {
        $theme = wp_get_theme();
        $themeDir = $theme->get_stylesheet_directory();

        $files = ['style.css', 'functions.php', 'header.php', 'footer.php', 'index.php'];
        $code = [];

        foreach ($files as $file) {
            $path = $themeDir . '/' . $file;
            if (file_exists($path)) {
                $content = file_get_contents($path);
                if (strlen($content) > 5000) {
                    $content = substr($content, 0, 5000) . "\\n... [truncated]";
                }
                $code[$file] = $content;
            }
        }

        return rest_ensure_response([
            'theme_name' => $theme->get('Name'),
            'theme_version' => $theme->get('Version'),
            'files' => $code,
        ]);
    }

    public static function get_products($request) {
        if (!function_exists('wc_get_products')) {
            return rest_ensure_response([
                'success' => false,
                'woocommerce_active' => false,
                'message' => 'WooCommerce is not active on this site',
            ]);
        }

        $body = json_decode($request->get_body(), true);
        $category = isset($body['category']) ? sanitize_text_field($body['category']) : '';
        $search = isset($body['search']) ? sanitize_text_field($body['search']) : '';
        $limit = min(intval(isset($body['limit']) ? $body['limit'] : 100), 500);

        $args = [
            'status' => 'publish',
            'limit' => $limit,
            'orderby' => 'date',
            'order' => 'DESC',
        ];

        if ($category) {
            $args['category'] = [$category];
        }
        if ($search) {
            $args['s'] = $search;
        }

        $products = wc_get_products($args);
        $total_count = wp_count_posts('product')->publish;

        $productData = [];
        foreach ($products as $product) {
            $productData[] = [
                'id' => $product->get_id(),
                'name' => $product->get_name(),
                'type' => $product->get_type(),
                'regular_price' => $product->get_regular_price(),
                'sale_price' => $product->get_sale_price(),
                'price' => $product->get_price(),
                'stock_status' => $product->get_stock_status(),
                'categories' => wp_get_post_terms($product->get_id(), 'product_cat', ['fields' => 'names']),
            ];
        }

        $categories = get_terms([
            'taxonomy' => 'product_cat',
            'hide_empty' => true,
        ]);

        $categoryData = [];
        if (!is_wp_error($categories)) {
            foreach ($categories as $cat) {
                $categoryData[] = [
                    'id' => $cat->term_id,
                    'name' => $cat->name,
                    'slug' => $cat->slug,
                    'count' => $cat->count,
                ];
            }
        }

        return rest_ensure_response([
            'success' => true,
            'woocommerce_active' => true,
            'total_count' => $total_count,
            'products_returned' => count($productData),
            'products' => $productData,
            'categories' => $categoryData,
        ]);
    }

    public static function verify_state($request) {
        $body = json_decode($request->get_body(), true);
        $target_type = sanitize_text_field($body['target_type'] ?? '');
        $target = sanitize_text_field($body['target'] ?? '');

        if (!$target_type || !$target) {
            return new WP_Error('missing_data', 'target_type and target required', ['status' => 400]);
        }

        switch ($target_type) {
            case 'product_price':
                if (!function_exists('wc_get_product')) {
                    return rest_ensure_response(['success' => false, 'error' => 'WooCommerce is not active']);
                }

                $products = [];

                if (strpos($target, 'ids:') === 0) {
                    $ids = array_filter(explode(',', substr($target, 4)), 'is_numeric');
                    foreach ($ids as $id) {
                        $product = wc_get_product(intval(trim($id)));
                        if ($product) {
                            $products[] = self::format_product_state($product);
                        }
                    }
                } elseif (is_numeric($target)) {
                    $product = wc_get_product(intval($target));
                    if ($product) {
                        $products[] = self::format_product_state($product);
                    }
                } else {
                    $args = ['status' => 'publish', 'limit' => 50, 'category' => [$target]];
                    $wc_products = wc_get_products($args);
                    foreach ($wc_products as $product) {
                        $products[] = self::format_product_state($product);
                    }
                }

                if (empty($products)) {
                    return rest_ensure_response(['success' => false, 'error' => 'No products found for target: ' . $target]);
                }

                return rest_ensure_response([
                    'success' => true,
                    'target_type' => 'product_price',
                    'target' => $target,
                    'products' => $products,
                ]);

            case 'option_value':
                $value = get_option($target);
                return rest_ensure_response([
                    'success' => true,
                    'target_type' => 'option_value',
                    'target' => $target,
                    'value' => is_array($value) ? wp_json_encode($value) : (string) $value,
                ]);

            case 'post_content':
                $post_id = 0;
                if (is_numeric($target)) {
                    $post_id = intval($target);
                } else {
                    $slug = trim($target, '/');
                    $found = get_page_by_path($slug);
                    if ($found) $post_id = $found->ID;
                }
                if (!$post_id) {
                    return rest_ensure_response(['success' => false, 'error' => 'Post not found for target: ' . $target]);
                }
                $post = get_post($post_id);
                return rest_ensure_response([
                    'success' => true,
                    'target_type' => 'post_content',
                    'target' => $target,
                    'post_id' => $post_id,
                    'content_length' => $post ? strlen($post->post_content) : 0,
                    'content_preview' => $post ? substr($post->post_content, 0, 500) : '',
                ]);

            case 'elementor_data':
                $post_id = 0;
                if (is_numeric($target)) {
                    $post_id = intval($target);
                } else {
                    $slug = trim($target, '/');
                    $found = get_page_by_path($slug);
                    if ($found) $post_id = $found->ID;
                }
                if (!$post_id) {
                    return rest_ensure_response(['success' => false, 'error' => 'Post not found for target: ' . $target]);
                }
                $el_data = get_post_meta($post_id, '_elementor_data', true);
                return rest_ensure_response([
                    'success' => true,
                    'target_type' => 'elementor_data',
                    'target' => $target,
                    'post_id' => $post_id,
                    'data_length' => $el_data ? strlen($el_data) : 0,
                    'content_preview' => $el_data ? substr($el_data, 0, 1000) : '',
                ]);

            default:
                return rest_ensure_response(['success' => false, 'error' => 'Unknown target_type: ' . $target_type]);
        }
    }

    public static function discover_routes($request) {
        $rest_server = rest_get_server();
        $routes = $rest_server->get_routes();

        $discovered = [];
        foreach ($routes as $route => $handlers) {
            if (strpos($route, '/fixpilot/') === 0) continue;

            foreach ($handlers as $handler) {
                $methods = array_keys($handler['methods'] ?? []);
                $args = [];
                if (isset($handler['args']) && is_array($handler['args'])) {
                    foreach ($handler['args'] as $arg_name => $arg_def) {
                        $args[] = $arg_name;
                    }
                }
                $discovered[] = [
                    'route' => $route,
                    'methods' => $methods,
                    'args' => $args,
                ];
            }
        }

        return rest_ensure_response([
            'success' => true,
            'route_count' => count($discovered),
            'routes' => $discovered,
        ]);
    }

    public static function rest_proxy($request) {
        $body = json_decode($request->get_body(), true);
        $route = sanitize_text_field($body['route'] ?? '');
        $method = strtoupper(sanitize_text_field($body['method'] ?? 'GET'));
        $params = $body['params'] ?? [];

        if (!$route) {
            return new WP_Error('missing_route', 'route is required', ['status' => 400]);
        }

        $route = '/' . ltrim($route, '/');
        $rest_request = new WP_REST_Request($method, $route);
        if (!empty($params)) {
            foreach ($params as $key => $val) {
                $rest_request->set_param($key, $val);
            }
        }

        $response = rest_do_request($rest_request);

        if (is_wp_error($response)) {
            return rest_ensure_response([
                'success' => false,
                'error' => $response->get_error_message(),
                'route' => $route,
                'method' => $method,
            ]);
        }

        $code = $response->get_status();
        $data = $response->get_data();

        return rest_ensure_response([
            'success' => $code >= 200 && $code < 300,
            'status_code' => $code,
            'route' => $route,
            'method' => $method,
            'response' => $data,
        ]);
    }

    public static function generic_option($request) {
        $body = json_decode($request->get_body(), true);
        $option_action = sanitize_text_field($body['option_action'] ?? 'get');
        $option_name = sanitize_text_field($body['option_name'] ?? '');

        if (!$option_name) {
            return new WP_Error('missing_option', 'option_name is required', ['status' => 400]);
        }

        if ($option_action === 'get') {
            $value = get_option($option_name);
            return rest_ensure_response([
                'success' => true,
                'option_name' => $option_name,
                'value' => is_array($value) ? wp_json_encode($value) : (string) $value,
            ]);
        }

        if ($option_action === 'update') {
            $old_value = get_option($option_name);
            $value = $body['option_value'] ?? '';
            $decoded = maybe_unserialize($value);
            update_option($option_name, $decoded);

            return rest_ensure_response([
                'success' => true,
                'option_name' => $option_name,
                'previous_value' => is_array($old_value) ? wp_json_encode($old_value) : (string) $old_value,
                'applied' => true,
            ]);
        }

        return new WP_Error('invalid_action', 'option_action must be "get" or "update"', ['status' => 400]);
    }

    private static function format_product_state($product) {
        return [
            'id' => $product->get_id(),
            'name' => $product->get_name(),
            'regular_price' => $product->get_regular_price(),
            'sale_price' => $product->get_sale_price(),
            'price' => $product->get_price(),
            'on_sale' => $product->is_on_sale(),
            'date_on_sale_from' => $product->get_date_on_sale_from() ? $product->get_date_on_sale_from()->format('Y-m-d') : '',
            'date_on_sale_to' => $product->get_date_on_sale_to() ? $product->get_date_on_sale_to()->format('Y-m-d') : '',
        ];
    }

    private static function extract_page_structure() {
        $url = home_url();
        $response = wp_remote_get($url, [
            'timeout' => 10,
            'headers' => ['User-Agent' => 'FixPilot-Context/1.0'],
        ]);

        if (is_wp_error($response)) {
            return ['css_classes' => [], 'nav_links' => '', 'body_classes' => ''];
        }

        $html = wp_remote_retrieve_body($response);

        preg_match_all('/class="([^"]+)"/', $html, $matches);
        $allClasses = [];
        foreach ($matches[1] as $classString) {
            $classes = explode(' ', $classString);
            foreach ($classes as $class) {
                $class = trim($class);
                if ($class && strlen($class) < 50) {
                    $allClasses[$class] = true;
                }
            }
        }
        $uniqueClasses = array_slice(array_keys($allClasses), 0, 100);

        preg_match('#<nav[^>]*>(.*?)</nav>#is', $html, $navMatch);
        $navLinks = '';
        if (!empty($navMatch[1])) {
            preg_match_all('#<a[^>]*>(.*?)</a>#is', $navMatch[1], $navLinkMatches);
            $navLinks = implode(' | ', array_slice($navLinkMatches[1], 0, 15));
        }

        preg_match('/<body[^>]*class="([^"]+)"/', $html, $bodyClassMatch);
        $bodyClasses = isset($bodyClassMatch[1]) ? $bodyClassMatch[1] : '';

        return [
            'css_classes' => $uniqueClasses,
            'nav_links' => $navLinks,
            'body_classes' => $bodyClasses,
        ];
    }

    // ─── Elementor Widget Map: scans ALL Elementor pages from the database
    //     (_elementor_data meta) and maps every widget ID to its text content,
    //     widget type, and page. This is the "source of truth" the AI uses
    //     to find the exact widget ID for a user's request.
    //     DOM scraping doesn't work — Elementor doesn't render data-element_id
    //     on the frontend by default. The DB meta is the only reliable source. ───
    public static function get_elementor_map($request) {
        if (!class_exists('\\Elementor\\Plugin')) {
            return rest_ensure_response(['success' => true, 'elementor_active' => false, 'pages' => []]);
        }

        // Find all published posts/pages that have _elementor_data
        global $wpdb;
        $page_ids = $wpdb->get_col($wpdb->prepare(
            "SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = %s AND meta_value != '' AND meta_value != '[]' LIMIT 100",
            '_elementor_data'
        ));

        if (empty($page_ids)) {
            return rest_ensure_response(['success' => true, 'elementor_active' => true, 'page_count' => 0, 'pages' => []]);
        }

        $pages = [];
        $totalWidgets = 0;
        $maxWidgets = 500; // Hard cap to keep response size reasonable

        foreach ($page_ids as $pid) {
            if ($totalWidgets >= $maxWidgets) break;

            $post = get_post($pid);
            if (!$post || $post->post_status !== 'publish') continue;

            $data = get_post_meta($pid, '_elementor_data', true);
            if (!$data) continue;

            $decoded = json_decode($data, true);
            if (!is_array($decoded)) continue;

            $widgets = self::extract_elementor_widgets_recursive($decoded);
            if (empty($widgets)) continue;

            $pageUrl = get_permalink($pid);
            $pageWidgets = [];
            foreach ($widgets as $w) {
                if ($totalWidgets >= $maxWidgets) break;
                $pageWidgets[] = [
                    'id' => $w['id'],
                    'type' => $w['type'],
                    'settings_preview' => $w['settings_preview'],
                ];
                $totalWidgets++;
            }

            $edit_mode = get_post_meta($pid, '_elementor_edit_mode', true);
            $edit_mode = $edit_mode ?: 'none';

            // For non-Elementor pages, include the actual HTML content so the AI
            // can modify it precisely (e.g. wrap specific words in a span) using post_update
            $content_preview = '';
            if ($edit_mode !== 'builder') {
                $raw_content = $post->post_content;
                if (function_exists('do_blocks')) {
                    $raw_content = do_blocks($raw_content);
                }
                $content_preview = substr($raw_content, 0, 1500);
            }

            $pages[] = [
                'page_id' => $pid,
                'page_title' => $post->post_title,
                'page_slug' => $post->post_name,
                'page_url' => $pageUrl,
                'elementor_edit_mode' => $edit_mode,
                'content_preview' => $content_preview,
                'widget_count' => count($pageWidgets),
                'widgets' => $pageWidgets,
            ];
        }

        return rest_ensure_response([
            'success' => true,
            'elementor_active' => true,
            'page_count' => count($pages),
            'total_widgets' => $totalWidgets,
            'pages' => $pages,
        ]);
    }

    // ─── Structural Site Manifest ───
    // Returns the site's real shape: Elementor widgets, Woo taxonomy, ACF fields,
    // forms, CPTs. Used by siteStackDiscovery for proactive site mapping.
    public static function get_site_manifest($request) {
        $theme = wp_get_theme();
        $plugins = get_option('active_plugins', []);
        $pluginData = [];
        foreach ($plugins as $pluginPath) {
            $data = get_plugin_data(WP_PLUGIN_DIR . '/' . $pluginPath);
            $slug = explode('/', $pluginPath)[0];
            $pluginData[] = [
                'slug' => $slug,
                'name' => $data['Name'] ?? basename($pluginPath),
                'version' => $data['Version'] ?? 'unknown',
            ];
        }

        $manifest = [
            'platform' => 'wordpress',
            'wp_version' => get_bloginfo('version'),
            'php_version' => phpversion(),
            'active_theme' => $theme->get('Name') . ' ' . $theme->get('Version'),
            'site_url' => home_url(),
            'plugins' => $pluginData,
            'elementor' => self::get_elementor_manifest(),
            'woocommerce' => self::get_woocommerce_manifest(),
            'acf' => self::get_acf_manifest(),
            'forms' => self::get_forms_manifest(),
            'custom_post_types' => self::get_cpt_manifest(),
            'seo' => self::get_seo_manifest(),
        ];

        return rest_ensure_response($manifest);
    }

    private static function get_elementor_manifest() {
        if (!class_exists('\\Elementor\\Plugin')) {
            return ['active' => false];
        }

        $kitId = get_option('elementor_active_kit_id', 0);

        // Extract widgets from the homepage's _elementor_data
        $homepageId = get_option('page_on_front') ?: get_option('page_for_posts');
        $widgets = [];
        $pageTitle = '';

        if ($homepageId) {
            $pageTitle = get_the_title($homepageId);
            $data = get_post_meta($homepageId, '_elementor_data', true);
            if ($data) {
                $decoded = json_decode($data, true);
                if (is_array($decoded)) {
                    $widgets = self::extract_elementor_widgets_recursive($decoded);
                }
            }
        }

        return [
            'active' => true,
            'kit_id' => $kitId,
            'homepage_id' => $homepageId,
            'homepage_title' => $pageTitle,
            'homepage_widget_count' => count($widgets),
            'homepage_widgets' => array_slice($widgets, 0, 30),
        ];
    }

    private static function extract_elementor_widgets_recursive($elements) {
        $widgets = [];
        foreach ($elements as $element) {
            if (isset($element['elType']) && $element['elType'] === 'widget') {
                $widgetType = $element['widgetType'] ?? 'unknown';
                $settings = $element['settings'] ?? [];
                $preview = [];
                foreach (['title', 'editor', 'text', 'header_size', 'link', 'image', 'caption', 'selected_icon'] as $key) {
                    if (isset($settings[$key])) {
                        $val = $settings[$key];
                        $preview[$key] = is_array($val) ? substr(wp_json_encode($val), 0, 120) : substr((string)$val, 0, 120);
                    }
                }
                $widgets[] = [
                    'id' => $element['id'] ?? '',
                    'type' => $widgetType,
                    'settings_preview' => $preview,
                ];
            }
            if (isset($element['elements']) && is_array($element['elements'])) {
                $widgets = array_merge($widgets, self::extract_elementor_widgets_recursive($element['elements']));
            }
        }
        return $widgets;
    }

    private static function get_woocommerce_manifest() {
        if (!class_exists('WooCommerce')) {
            return ['active' => false];
        }
        $currency = get_woocommerce_currency();
        $productCount = wp_count_posts('product')->publish;
        $categories = get_terms(['taxonomy' => 'product_cat', 'hide_empty' => false]);
        $catData = [];
        if (!is_wp_error($categories)) {
            foreach (array_slice($categories, 0, 20) as $cat) {
                $catData[] = ['id' => $cat->term_id, 'name' => $cat->name, 'slug' => $cat->slug, 'count' => $cat->count];
            }
        }
        return [
            'active' => true,
            'currency' => $currency,
            'product_count' => $productCount,
            'category_count' => is_wp_error($categories) ? 0 : count($categories),
            'categories' => $catData,
        ];
    }

    private static function get_acf_manifest() {
        if (!function_exists('acf_get_field_groups')) {
            return ['active' => false];
        }
        $groups = acf_get_field_groups();
        $groupData = [];
        foreach (array_slice($groups, 0, 15) as $group) {
            $fields = acf_get_fields($group['key']);
            $fieldData = [];
            foreach (array_slice($fields, 0, 10) as $field) {
                $fieldData[] = ['key' => $field['key'], 'label' => $field['label'], 'type' => $field['type']];
            }
            $groupData[] = [
                'title' => $group['title'],
                'key' => $group['key'],
                'field_count' => count($fields),
                'fields' => $fieldData,
            ];
        }
        return ['active' => true, 'group_count' => count($groups), 'groups' => $groupData];
    }

    private static function get_forms_manifest() {
        $forms = [];

        // Contact Form 7
        if (post_type_exists('wpcf7_contact_form')) {
            $cf7Forms = get_posts(['post_type' => 'wpcf7_contact_form', 'numberposts' => 20]);
            $forms[] = [
                'plugin' => 'contact-form-7',
                'count' => count($cf7Forms),
                'forms' => array_map(function($f) { return ['id' => $f->ID, 'title' => $f->post_title]; }, $cf7Forms),
            ];
        }

        // WPForms
        if (post_type_exists('wpforms')) {
            $wpForms = get_posts(['post_type' => 'wpforms', 'numberposts' => 20]);
            $forms[] = [
                'plugin' => 'wpforms',
                'count' => count($wpForms),
                'forms' => array_map(function($f) { return ['id' => $f->ID, 'title' => $f->post_title]; }, $wpForms),
            ];
        }

        // Gravity Forms
        if (class_exists('GFForms')) {
            $gfForms = GFAPI::get_forms();
            $forms[] = [
                'plugin' => 'gravityforms',
                'count' => count($gfForms),
                'forms' => array_map(function($f) { return ['id' => $f['id'], 'title' => $f['title']]; }, $gfForms),
            ];
        }

        // Ninja Forms
        if (class_exists('Ninja_Forms')) {
            $nfForms = Ninja_Forms()->form()->get_forms();
            $forms[] = [
                'plugin' => 'ninja-forms',
                'count' => count($nfForms),
                'forms' => array_map(function($f) { return ['id' => $f->get_id(), 'title' => $f->get_setting('title')]; }, $nfForms),
            ];
        }

        return $forms;
    }

    private static function get_cpt_manifest() {
        $cpts = get_post_types(['_builtin' => false, 'public' => true], 'objects');
        $cptData = [];
        foreach (array_slice($cpts, 0, 20) as $cpt) {
            $cptData[] = ['name' => $cpt->name, 'label' => $cpt->label, 'count' => wp_count_posts($cpt->name)->publish ?? 0];
        }
        return $cptData;
    }

    private static function get_seo_manifest() {
        $seoPlugins = [
            'wordpress-seo/wp-seo.php' => 'Yoast SEO',
            'seo-by-rank-math/rank-math.php' => 'Rank Math',
            'all-in-one-seo-pack/all_in_one_seo_pack.php' => 'All in One SEO',
            'seopress/seopress.php' => 'SEOPress',
        ];
        $active = get_option('active_plugins', []);
        foreach ($active as $path) {
            if (isset($seoPlugins[$path])) {
                return ['active' => true, 'plugin' => $seoPlugins[$path]];
            }
        }
        return ['active' => false];
    }

    public static function upload_media($request) {
        $files = $request->get_file_params();
        if (empty($files['file'])) {
            return new WP_Error('no_file', 'No file provided', ['status' => 400]);
        }

        $file = $files['file'];
        $upload = wp_handle_upload($file, ['test_form' => false]);

        // Fallback for safe document types that fail WP's strict mime checks
        if (isset($upload['error'])) {
            $ud = wp_upload_dir();
            if (empty($ud['error']) && !empty($ud['path'])) {
                $filename = wp_unique_filename($ud['path'], $file['name']);
                $dest = trailingslashit($ud['path']) . $filename;
                if (move_uploaded_file($file['tmp_name'], $dest)) {
                    $upload = [
                        'file' => $dest,
                        'url'  => trailingslashit($ud['url']) . $filename,
                        'type' => !empty($file['type']) ? $file['type'] : 'application/octet-stream',
                    ];
                } else {
                    return new WP_Error('upload_error', $upload['error'], ['status' => 500]);
                }
            } else {
                return new WP_Error('upload_error', $upload['error'], ['status' => 500]);
            }
        }

        $mime = !empty($upload['type']) ? $upload['type'] : 'application/octet-stream';
        $attachment = [
            'post_title'   => sanitize_file_name($file['name']),
            'post_content' => '',
            'post_status'  => 'inherit',
            'post_mime_type' => $mime,
        ];

        $attach_id = wp_insert_attachment($attachment, $upload['file']);

        if (is_wp_error($attach_id)) {
            return $attach_id;
        }

        require_once(ABSPATH . 'wp-admin/includes/image.php');
        $attach_data = wp_generate_attachment_metadata($attach_id, $upload['file']);
        wp_update_attachment_metadata($attach_id, $attach_data);

        return rest_ensure_response([
            'success'       => true,
            'attachment_id' => $attach_id,
            'url'          => $upload['url'],
            'file_name'    => $file['name'],
            'is_image'     => (strpos($mime, 'image/') === 0),
        ]);
    }

    private static function log_fix($fix_id, $description, $instruction, $before_state) {
        global $wpdb;
        $table = $wpdb->prefix . 'fixpilot_fixes';

        $wpdb->insert($table, [
            'fix_id' => $fix_id,
            'domain_hash' => fixpilot_get_fingerprint(),
            'fix_description' => $description,
            'json_instruction' => wp_json_encode($instruction),
            'before_state' => wp_json_encode($before_state),
            'status' => 'applied',
            'rolled_back' => 0,
        ]);
    }
}`
};