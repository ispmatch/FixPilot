export default {
  name: 'class-fix-applier.php',
  path: 'includes/',
  language: 'php',
  code: `<?php
if (!defined('ABSPATH')) {
    exit;
}

class FixPilot_Fix_Applier {

    public static function init() {
        add_action('wp_head', [__CLASS__, 'output_injected_css'], 999);
    }

    private static $injected_css = [];

    public static function apply($instruction, $fix_id) {
        $before_state = [
            'fix_id' => $fix_id,
            'changes' => [],
            'timestamp' => current_time('mysql'),
        ];

        $changes = is_array($instruction) && isset($instruction['changes'])
            ? $instruction['changes']
            : [$instruction];

        foreach ($changes as $change) {
            $type = $change['change_type'] ?? '';
            $target = $change['target'] ?? '';
            $value = $change['value'] ?? '';

            switch ($type) {
                case 'css_inject':
                    $before_state['changes'][] = self::apply_css($target, $value, $fix_id);
                    break;

                case 'option_update':
                    $before_state['changes'][] = self::apply_option_update($target, $value);
                    break;

                case 'post_update':
                    $before_state['changes'][] = self::apply_post_update($target, $value);
                    break;

                case 'post_content_patch':
                    $before_state['changes'][] = self::apply_post_content_patch($target, $value);
                    break;

                case 'post_meta_update':
                    $before_state['changes'][] = self::apply_post_meta_update($target, $value);
                    break;

                case 'menu_update':
                    $before_state['changes'][] = self::apply_menu_update($target, $value);
                    break;

                case 'widget_update':
                    $before_state['changes'][] = self::apply_widget_update($target, $value);
                    break;

                case 'woocommerce_product_update':
                    $before_state['changes'][] = self::apply_woocommerce_update($target, $value);
                    break;

                case 'rest_api_call':
                    $before_state['changes'][] = self::apply_rest_api_call($target, $value);
                    break;

                case 'generic_option_update':
                    $before_state['changes'][] = self::apply_generic_option_update($target, $value);
                    break;

                default:
                    $before_state['changes'][] = [
                        'type' => $type,
                        'error' => 'Unknown change type',
                    ];
            }
        }

        // Flush cache so changes are visible immediately on the live site
        if (function_exists('wp_cache_flush')) {
            wp_cache_flush();
        }
        if (function_exists('w3tc_flush_all')) {
            w3tc_flush_all();
        }
        if (function_exists('wp_super_cache_flush')) {
            wp_super_cache_flush();
        }
        if (function_exists('rocket_clean_domain')) {
            rocket_clean_domain();
        }
        if (function_exists('wp_fastest_cache_clear_all')) {
            wp_fastest_cache_clear_all();
        }
        if (function_exists('litespeed_purge_all')) {
            litespeed_purge_all();
        }

        // Note: Per-post Elementor CSS clearing is handled by individual change
        // handlers (they pass the specific post_id). We do NOT call the global
        // clear_elementor_cache() here — it would regenerate CSS for ALL pages.

        return $before_state;
    }

    private static function apply_css($target, $value, $fix_id) {
        $css_key = 'fixpilot_css_' . $fix_id;
        $existing = get_option($css_key, '');

        self::$injected_css[$fix_id] = $value;

        update_option($css_key, $value);

        return [
            'type' => 'css_inject',
            'target' => $target,
            'previous_css' => $existing,
            'applied' => true,
        ];
    }

    public static function output_injected_css() {
        $all_css = '';
        $options = wp_load_alloptions();
        foreach ($options as $key => $val) {
            if (strpos($key, 'fixpilot_css_') === 0 && !empty($val)) {
                $all_css .= "\\n" . $val;
            }
        }
        if ($all_css) {
            echo "<!-- FixPilot CSS -->\\n<style>" . esc_html($all_css) . "\\n</style>\\n";
        }
    }

    // ─── Force Elementor to regenerate its compiled CSS files ───
    // Without this, Elementor serves stale CSS from its cache even after
    // the _elementor_data meta has been updated. The change exists in the
    // database but is invisible on the frontend.
    public static function clear_elementor_cache($post_id = 0) {
        // ONLY clear per-post Elementor CSS — NEVER call files_manager->clear_cache()
        // globally. That method regenerates CSS for ALL pages on the site, which
        // breaks layouts, misaligns images, and resets spacing across pages that
        // were not touched by the fix. This was the root cause of the
        // studiotitans.com page corruption (July 2026).
        if ($post_id) {
            delete_post_meta($post_id, '_elementor_css');
            delete_post_meta($post_id, '_elementor_page_assets');
        }
    }

    private static function apply_option_update($target, $value) {
        $old_value = get_option($target);
        $decoded = maybe_unserialize($value);

        update_option($target, $decoded);

        return [
            'type' => 'option_update',
            'target' => $target,
            'previous_value' => $old_value,
            'applied' => true,
        ];
    }

    private static function apply_post_update($target, $value) {
        $post_id = 0;

        if (is_numeric($target)) {
            $post_id = intval($target);
        } else {
            $slug = $target;
            if (strpos($slug, 'path:') === 0) {
                $slug = substr($slug, 5);
            }
            $slug = trim($slug, '/');

            $found = get_page_by_path($slug);
            if ($found) {
                $post_id = $found->ID;
            } else {
                $found_posts = get_posts([
                    'name' => $slug,
                    'post_type' => ['page', 'post', 'wpcf7_contact_form', 'wpforms', 'product', 'elementor_library'],
                    'post_status' => 'any',
                    'numberposts' => 1,
                ]);
                if (empty($found_posts)) {
                    $title_query = new WP_Query([
                        'post_type' => ['page', 'post', 'wpcf7_contact_form', 'wpforms', 'product', 'elementor_library'],
                        'post_status' => 'any',
                        'posts_per_page' => 1,
                        'title' => $slug,
                        'update_post_meta_cache' => false,
                        'update_post_term_cache' => false,
                    ]);
                    if (!empty($title_query->posts)) {
                        $found_posts = [$title_query->posts[0]];
                    }
                }
                if (!empty($found_posts)) {
                    $post_id = $found_posts[0]->ID;
                }
            }
        }

        if (!$post_id) {
            return ['type' => 'post_update', 'error' => 'Page/post not found for target: ' . $target . '. Use the page slug (e.g. "contact-us") or numeric post ID.'];
        }

        $post = get_post($post_id);
        if (!$post) {
            return ['type' => 'post_update', 'error' => 'Post not found: ' . $post_id];
        }

        if (preg_match('/\\[([A-Z_]+)\\]/', $value)) {
            return ['type' => 'post_update', 'error' => 'Fix value contains unresolved placeholder(s). The AI must provide actual content, not placeholders like [MAP_ELEMENT] or [IMAGE_URL].'];
        }

        $old_content = $post->post_content;

        wp_update_post([
            'ID' => $post_id,
            'post_content' => $value,
        ]);

        // If this is an Elementor page, regenerate its CSS
        self::clear_elementor_cache($post_id);

        return [
            'type' => 'post_update',
            'target' => $target,
            'resolved_post_id' => $post_id,
            'previous_content' => $old_content,
            'applied' => true,
        ];
    }

    private static function apply_post_meta_update($target, $value) {
        $post_id = 0;
        if (is_numeric($target)) {
            $post_id = intval($target);
        } else {
            $slug = trim($target, '/');
            $found = get_page_by_path($slug);
            if ($found) {
                $post_id = $found->ID;
            } else {
                $query = new WP_Query([
                    'post_type' => ['page', 'post', 'wpcf7_contact_form', 'wpforms', 'product', 'elementor_library'],
                    'post_status' => 'any',
                    'posts_per_page' => 1,
                    'title' => $slug,
                    'update_post_meta_cache' => false,
                    'update_post_term_cache' => false,
                ]);
                if (!empty($query->posts)) {
                    $post_id = $query->posts[0]->ID;
                }
            }
        }

        if (!$post_id) {
            return ['type' => 'post_meta_update', 'error' => 'Page/post not found for target: ' . $target . '. Use the page slug (e.g. "contact-us"), numeric post ID, or the form/page title.'];
        }

        $config = is_array($value) ? $value : json_decode($value, true);
        if (!$config || empty($config['meta_key'])) {
            return ['type' => 'post_meta_update', 'error' => 'value must be JSON with meta_key and meta_value, e.g. {"meta_key":"_elementor_data","meta_value":"..."}'];
        }

        $meta_key = $config['meta_key'];
        $meta_value = $config['meta_value'];
        $old_value = get_post_meta($post_id, $meta_key, true);

        // ─── Elementor _elementor_data: surgical widget merge ───
        // The orchestrator sends a shortcut {widget_id, updates} object. We MUST
        // merge it into the existing _elementor_data array — never overwrite the
        // entire array, or the whole page structure is destroyed.
        if ($meta_key === '_elementor_data' && is_array($meta_value) && isset($meta_value['widget_id']) && isset($meta_value['updates'])) {
            $existing_data = is_string($old_value) ? json_decode($old_value, true) : [];
            if (!is_array($existing_data)) {
                $existing_data = [];
            }

            $widget_id = $meta_value['widget_id'];
            $updates = $meta_value['updates'];
            $merged = false;

            // Recursively walk the Elementor data tree to find the widget by id
            $walk = function(&$elements) use (&$walk, $widget_id, $updates, &$merged) {
                foreach ($elements as &$el) {
                    if (isset($el['id']) && $el['id'] === $widget_id) {
                        if (!isset($el['settings']) || !is_array($el['settings'])) {
                            $el['settings'] = [];
                        }
                        foreach ($updates as $k => $v) {
                            $el['settings'][$k] = $v;
                        }
                        $merged = true;
                    }
                    if (isset($el['elements']) && is_array($el['elements'])) {
                        $walk($el['elements']);
                    }
                }
            };
            $walk($existing_data);

            if (!$merged) {
                return [
                    'type' => 'post_meta_update',
                    'target' => $target,
                    'resolved_post_id' => $post_id,
                    'error' => 'Widget ID "' . $widget_id . '" not found in _elementor_data. The widget may have been removed or edited since discovery. Re-run stack discovery or provide a valid widget_id from the Stack Manifest.',
                    'applied' => false,
                ];
            }

            update_post_meta($post_id, $meta_key, wp_json_encode($existing_data));

            // ─── Per-post CSS clear only (NO document->save()) ───
            // We intentionally do NOT call document->save() here. It re-renders
            // the entire page, which can corrupt widget data, change element IDs,
            // break layouts, and misalign images across the page (this was the
            // root cause of the studiotitans.com corruption). The _elementor_data
            // meta is already updated surgically above — that is sufficient for
            // Elementor-rendered pages.
            self::clear_elementor_cache($post_id);

            return [
                'type' => 'post_meta_update',
                'target' => $target,
                'resolved_post_id' => $post_id,
                'meta_key' => $meta_key,
                'widget_id' => $widget_id,
                'updates_applied' => $updates,
                'previous_value' => is_string($old_value) ? $old_value : wp_json_encode($old_value),
                'applied' => true,
            ];
        }

        // ─── Standard meta update (non-Elementor, or full-array Elementor) ───
        if (is_array($meta_value) || is_object($meta_value)) {
            $meta_value = wp_json_encode($meta_value);
        }

        update_post_meta($post_id, $meta_key, $meta_value);

        // If we touched Elementor meta, clear per-post CSS only (no global clear)
        if (strpos($meta_key, '_elementor') === 0) {
            self::clear_elementor_cache($post_id);
        }

        return [
            'type' => 'post_meta_update',
            'target' => $target,
            'resolved_post_id' => $post_id,
            'meta_key' => $meta_key,
            'previous_value' => is_string($old_value) ? $old_value : wp_json_encode($old_value),
            'applied' => true,
        ];
    }

    // ─── Post Content Patch: targeted search-and-replace ───
    // Searches for text in BOTH post_content AND _elementor_data (widget settings).
    // On Elementor pages, heading/text content lives in _elementor_data JSON, not
    // in post_content. This method handles both cases:
    //   1. If found in post_content → str_replace in post_content
    //   2. If NOT found in post_content but _elementor_data exists → search
    //      within widget settings in the Elementor data JSON, replace there,
    //      then sync post_content via Elementor's Document::save()
    // value = JSON {"search": "text to find", "replace": "replacement text"}
    private static function apply_post_content_patch($target, $value) {
        $post_id = 0;
        if (is_numeric($target)) {
            $post_id = intval($target);
        } else {
            $slug = trim($target, '/');
            $found = get_page_by_path($slug);
            if ($found) {
                $post_id = $found->ID;
            } else {
                $query = new WP_Query([
                    'post_type' => ['page', 'post', 'elementor_library'],
                    'post_status' => 'any',
                    'posts_per_page' => 1,
                    'title' => $slug,
                    'update_post_meta_cache' => false,
                    'update_post_term_cache' => false,
                ]);
                if (!empty($query->posts)) {
                    $post_id = $query->posts[0]->ID;
                }
            }
        }

        if (!$post_id) {
            return ['type' => 'post_content_patch', 'error' => 'Page/post not found for target: ' . $target];
        }

        $config = is_array($value) ? $value : json_decode($value, true);
        if (!$config || empty($config['search']) || !isset($config['replace'])) {
            return ['type' => 'post_content_patch', 'error' => 'value must be JSON with "search" and "replace" keys'];
        }

        $post = get_post($post_id);
        if (!$post) {
            return ['type' => 'post_content_patch', 'error' => 'Post not found: ' . $post_id];
        }

        $old_content = $post->post_content;
        $search = $config['search'];
        $replace = $config['replace'];

        // ─── Priority: If this is an Elementor page, patch _elementor_data FIRST ───
        // Elementor pages render from _elementor_data (widget settings), not from
        // post_content. Even if the search string exists in post_content (Elementor
        // auto-generates a fallback), patching post_content alone is invisible.
        // We must patch the widget settings in _elementor_data, then sync post_content.
        $elementor_data = get_post_meta($post_id, '_elementor_data', true);

        if ($elementor_data) {
            $el_data = is_string($elementor_data) ? json_decode($elementor_data, true) : $elementor_data;
            if (is_array($el_data)) {
                // Text fields within Elementor widget settings where content lives.
                // Expanded to cover all common Elementor text-bearing widgets.
                $text_fields = [
                    'title', 'editor', 'description_text', 'title_text',
                    'testimonial_content', 'testimonial_name', 'testimonial_job',
                    'text', 'caption', 'description',
                    'inner_text', 'plain_text', 'sub_title', 'label',
                    'button_text', 'price_text', 'inner_text_content',
                    'text_content', 'html_content', 'content_text',
                    'heading_text', 'subheading', 'badge_text', 'year_text',
                    'counter_title', 'counter_description', 'list_text',
                    'tab_title', 'tab_content', 'accordion_title', 'accordion_content',
                    'phone_number', 'email', 'address', 'quote_text', 'author_name',
                    'cta_text', 'link_text', 'placeholder', 'subtitle', 'message_text',
                    'content', 'html', 'rich_text', 'text_editor', 'title_area',
                    'description_area', 'primary_text', 'secondary_text', 'content_editor',
                    'heading', 'sub_heading', 'price', 'duration', 'feature_text',
                    'promo_text', 'offer_text', 'tagline', 'slogan', 'label_text',
                    'note_text', 'notice_text', 'alert_text', 'info_text', 'summary_text',
                ];

                $patched = false;

                // Recursively walk the Elementor data tree to find and patch text.
                // Handles three matching strategies for robustness:
                //   1. Exact match in the raw value
                //   2. HTML-encoded search match (e.g. search "A & B" finds "A &amp; B")
                //   3. Decoded match (both value and search decoded, then compared)
                $walk_and_patch = function(&$elements) use (&$walk_and_patch, $search, $replace, $text_fields, &$patched) {
                    foreach ($elements as &$el) {
                        if (isset($el['settings']) && is_array($el['settings'])) {
                            foreach ($text_fields as $field) {
                                if (isset($el['settings'][$field]) && is_string($el['settings'][$field])) {
                                    $val = $el['settings'][$field];

                                    // Strategy 1: exact match in original value
                                    if (strpos($val, $search) !== false) {
                                        $el['settings'][$field] = str_replace($search, $replace, $val);
                                        $patched = true;
                                        continue;
                                    }

                                    // Strategy 2: HTML-encoded search (handles & → &amp;, " → &quot;, etc.)
                                    $encoded_search = htmlentities($search, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                                    if ($encoded_search !== $search && strpos($val, $encoded_search) !== false) {
                                        $el['settings'][$field] = str_replace($encoded_search, $replace, $val);
                                        $patched = true;
                                        continue;
                                    }

                                    // Strategy 3: decoded match (both sides decoded)
                                    $decoded_val = html_entity_decode($val, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                                    $decoded_search = html_entity_decode($search, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                                    if ($decoded_val !== $val && strpos($decoded_val, $decoded_search) !== false) {
                                        // Replace in the decoded value (safe — original had entities to decode)
                                        $el['settings'][$field] = str_replace($decoded_search, $replace, $decoded_val);
                                        $patched = true;
                                        continue;
                                    }
                                }
                            }
                        }
                        if (isset($el['elements']) && is_array($el['elements'])) {
                            $walk_and_patch($el['elements']);
                        }
                    }
                };
                $walk_and_patch($el_data);

                if ($patched) {
                    // Save the updated _elementor_data
                    update_post_meta($post_id, '_elementor_data', wp_json_encode($el_data));

                    // Note: We do NOT call document->save() — it re-renders the
                    // entire page and can corrupt widget data and break layouts.
                    // The _elementor_data meta update is sufficient for changes
                    // to be visible on Elementor-rendered pages.
                    self::clear_elementor_cache($post_id);

                    return [
                        'type' => 'post_content_patch',
                        'target' => $target,
                        'resolved_post_id' => $post_id,
                        'source' => '_elementor_data',
                        'search' => $search,
                        'replace' => $replace,
                        'applied' => true,
                    ];
                }
            }
        }

        // ─── Fallback: Not an Elementor page, or text not in widget settings ───
        // Search in post_content directly (non-Elementor pages)
        if (strpos($old_content, $search) !== false) {
            $new_content = str_replace($search, $replace, $old_content);

            wp_update_post([
                'ID' => $post_id,
                'post_content' => $new_content,
            ]);

            self::clear_elementor_cache($post_id);

            return [
                'type' => 'post_content_patch',
                'target' => $target,
                'resolved_post_id' => $post_id,
                'source' => 'post_content',
                'search' => $search,
                'replace' => $replace,
                'previous_content_length' => strlen($old_content),
                'new_content_length' => strlen($new_content),
                'applied' => true,
            ];
        }

        // ─── Not found in post_content or _elementor_data ───
        $el_data_length = $elementor_data ? strlen(is_string($elementor_data) ? $elementor_data : wp_json_encode($elementor_data)) : 0;
        return [
            'type' => 'post_content_patch',
            'target' => $target,
            'resolved_post_id' => $post_id,
            'error' => 'Search string not found in post_content or _elementor_data. Searched for: "' . substr($search, 0, 100) . '". post_content length: ' . strlen($old_content) . ', _elementor_data length: ' . $el_data_length . '. The text may use different spacing, HTML entities, or may not exist on this page.',
            'applied' => false,
        ];
    }

    private static function apply_menu_update($target, $value) {
        $menus = wp_get_nav_menus();
        $updated = [];

        foreach ($menus as $menu) {
            $items = wp_get_nav_menu_items($menu->term_id);
            if (empty($items)) continue;

            foreach ($items as $item) {
                if (strtolower(trim($item->title)) === strtolower(trim($target))) {
                    $old_title = $item->title;
                    $db_id = $item->db_id;

                    wp_update_post([
                        'ID'           => $db_id,
                        'post_title'   => $value,
                        'post_excerpt' => $value,
                    ]);
                    wp_update_nav_menu_item($menu->term_id, $db_id, [
                        'menu-item-title' => $value,
                    ]);

                    $updated[] = [
                        'menu_id'      => $menu->term_id,
                        'menu_name'    => $menu->name,
                        'item_db_id'   => $db_id,
                        'old_title'    => $old_title,
                        'new_title'    => $value,
                    ];
                }
            }
        }

        if (empty($updated)) {
            $menu_names = array_map(function($m) { return $m->name; }, $menus);
            return [
                'type'    => 'menu_update',
                'target'  => $target,
                'value'   => $value,
                'error'   => 'No menu item found with label "' . $target . '". ' .
                             (empty($menu_names) ? 'No menus exist on this site.' : 'Available menus: ' . implode(', ', $menu_names)),
                'applied' => false,
            ];
        }

        return [
            'type'           => 'menu_update',
            'target'         => $target,
            'value'          => $value,
            'updated_items'  => $updated,
            'applied'        => true,
        ];
    }

    private static function apply_woocommerce_update($target, $value) {
        if (!function_exists('wc_get_products')) {
            return ['type' => 'woocommerce_product_update', 'error' => 'WooCommerce is not active on this site'];
        }

        $config = is_array($value) ? $value : json_decode($value, true);
        if (!$config) {
            return ['type' => 'woocommerce_product_update', 'error' => 'Invalid configuration JSON in value field'];
        }

        $action = isset($config['action']) ? $config['action'] : 'sale';
        $discount = floatval(isset($config['discount_amount']) ? $config['discount_amount'] : 0);
        $discountType = isset($config['discount_type']) ? $config['discount_type'] : 'fixed';
        $dateFrom = isset($config['sale_price_dates_from']) ? $config['sale_price_dates_from'] : '';
        $dateTo = isset($config['sale_price_dates_to']) ? $config['sale_price_dates_to'] : '';

        $products = [];

        if (strpos($target, 'ids:') === 0) {
            $ids = array_filter(explode(',', substr($target, 4)), 'is_numeric');
            foreach ($ids as $id) {
                $product = wc_get_product(intval(trim($id)));
                if ($product) {
                    $products[] = $product;
                }
            }
        } else {
            $args = [
                'status' => 'publish',
                'limit' => 500,
                'category' => [$target],
            ];
            $products = wc_get_products($args);

            if (empty($products)) {
                $args2 = [
                    'status' => 'publish',
                    'limit' => 500,
                    's' => $target,
                ];
                $products = wc_get_products($args2);
            }
        }

        if (empty($products)) {
            return ['type' => 'woocommerce_product_update', 'error' => 'No products found matching: ' . $target];
        }

        $results = [];

        foreach ($products as $product) {
            $oldRegular = $product->get_regular_price();
            $oldSale = $product->get_sale_price();

            if ($action === 'sale') {
                $regular = floatval($product->get_regular_price());
                if ($regular <= 0) {
                    $results[] = ['id' => $product->get_id(), 'name' => $product->get_name(), 'skipped' => true, 'reason' => 'No regular price set'];
                    continue;
                }

                $newSalePrice = $discountType === 'percentage'
                    ? $regular * (1 - $discount / 100)
                    : $regular - $discount;
                $newSalePrice = max(0, round($newSalePrice, 2));

                $product->set_sale_price(number_format($newSalePrice, 2, '.', ''));

                if ($dateFrom) {
                    $product->set_date_on_sale_from($dateFrom);
                }
                if ($dateTo) {
                    $product->set_date_on_sale_to($dateTo);
                }

                $product->save();

                if (function_exists('wc_delete_product_transients')) {
                    wc_delete_product_transients($product->get_id());
                }
                clean_post_cache($product->get_id());

                $results[] = [
                    'id' => $product->get_id(),
                    'name' => $product->get_name(),
                    'old_regular_price' => $oldRegular,
                    'old_sale_price' => $oldSale,
                    'new_sale_price' => number_format($newSalePrice, 2, '.', ''),
                    'updated' => true,
                ];
            } elseif ($action === 'remove_sale') {
                $product->set_sale_price('');
                $product->set_date_on_sale_from('');
                $product->set_date_on_sale_to('');
                $product->save();

                if (function_exists('wc_delete_product_transients')) {
                    wc_delete_product_transients($product->get_id());
                }
                clean_post_cache($product->get_id());

                $results[] = [
                    'id' => $product->get_id(),
                    'name' => $product->get_name(),
                    'old_sale_price' => $oldSale,
                    'updated' => true,
                    'action' => 'sale_removed',
                ];
            }
        }

        return [
            'type' => 'woocommerce_product_update',
            'target' => $target,
            'products_updated' => count(array_filter($results, function($r) { return !empty($r['updated']); })),
            'results' => $results,
            'applied' => true,
        ];
    }

    private static function apply_rest_api_call($target, $value) {
        $config = is_array($value) ? $value : json_decode($value, true);
        if (!$config) {
            return ['type' => 'rest_api_call', 'error' => 'Invalid configuration JSON in value field'];
        }

        $method = strtoupper($config['method'] ?? 'GET');
        $params = $config['params'] ?? [];
        $route = '/' . ltrim($target, '/');

        $rest_request = new WP_REST_Request($method, $route);
        if (!empty($params)) {
            foreach ($params as $key => $val) {
                $rest_request->set_param($key, $val);
            }
        }

        $response = rest_do_request($rest_request);

        if (is_wp_error($response)) {
            return ['type' => 'rest_api_call', 'target' => $target, 'error' => $response->get_error_message()];
        }

        $code = $response->get_status();
        $data = $response->get_data();

        return [
            'type' => 'rest_api_call',
            'target' => $target,
            'method' => $method,
            'status_code' => $code,
            'response_preview' => substr(wp_json_encode($data), 0, 500),
            'applied' => $code >= 200 && $code < 300,
        ];
    }

    private static function apply_generic_option_update($target, $value) {
        $old_value = get_option($target);
        $decoded = maybe_unserialize($value);

        update_option($target, $decoded);

        return [
            'type' => 'generic_option_update',
            'target' => $target,
            'previous_value' => is_array($old_value) ? wp_json_encode($old_value) : (string) $old_value,
            'applied' => true,
        ];
    }

    private static function apply_widget_update($target, $value) {
        $old_widgets = get_option('sidebars_widgets', []);
        $decoded = json_decode($value, true);

        if ($decoded && isset($decoded['sidebar']) && isset($decoded['widgets'])) {
            $sidebar = $decoded['sidebar'];
            $old_widgets[$sidebar] = $decoded['widgets'];
            update_option('sidebars_widgets', $old_widgets);
        }

        return [
            'type' => 'widget_update',
            'target' => $target,
            'applied' => true,
        ];
    }
}`
};