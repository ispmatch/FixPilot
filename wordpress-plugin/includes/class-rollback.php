<?php
if (!defined('ABSPATH')) {
    exit;
}

class FixPilot_Rollback {

    public static function init() {}

    public static function rollback($fix_id) {
        global $wpdb;
        $table = $wpdb->prefix . 'fixpilot_fixes';

        $record = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM $table WHERE fix_id = %s",
            $fix_id
        ));

        if (!$record) {
            return new WP_Error('not_found', 'Fix not found in local log', ['status' => 404]);
        }

        if ($record->rolled_back) {
            return new WP_Error('already_reverted', 'Fix already rolled back', ['status' => 400]);
        }

        $before_state = json_decode($record->before_state, true);
        $restored = [];

        if (isset($before_state['changes'])) {
            foreach ($before_state['changes'] as $change) {
                $restored[] = self::revert_change($change, $fix_id);
            }
        }

        $wpdb->update($table, [
            'status' => 'reverted',
            'rolled_back' => 1,
        ], ['fix_id' => $fix_id]);

        return $restored;
    }

    private static function revert_change($change, $fix_id) {
        $type = $change['type'] ?? '';

        switch ($type) {
            case 'css_inject':
                delete_option('fixpilot_css_' . $fix_id);
                return ['type' => 'css_inject', 'reverted' => true];

            case 'option_update':
                if (isset($change['previous_value'])) {
                    update_option($change['target'], $change['previous_value']);
                }
                return ['type' => 'option_update', 'target' => $change['target'], 'reverted' => true];

            case 'post_update':
                if (isset($change['previous_content'])) {
                    wp_update_post([
                        'ID' => intval($change['target']),
                        'post_content' => $change['previous_content'],
                    ]);
                }
                return ['type' => 'post_update', 'target' => $change['target'], 'reverted' => true];

            case 'menu_update':
                if (isset($change['updated_items'])) {
                    foreach ($change['updated_items'] as $item) {
                        wp_update_nav_menu_item($item['menu_id'], $item['item_db_id'], [
                            'menu-item-title' => $item['old_title'],
                        ]);
                        wp_update_post([
                            'ID'           => $item['item_db_id'],
                            'post_title'   => $item['old_title'],
                            'post_excerpt' => $item['old_title'],
                        ]);
                    }
                    return ['type' => 'menu_update', 'reverted' => true];
                }
                return ['type' => 'menu_update', 'reverted' => false, 'note' => 'No menu items to revert'];

            case 'generic_option_update':
                if (isset($change['previous_value'])) {
                    update_option($change['target'], maybe_unserialize($change['previous_value']));
                }
                return ['type' => 'generic_option_update', 'target' => $change['target'], 'reverted' => true];

            case 'post_meta_update':
                if (isset($change['previous_value']) && isset($change['resolved_post_id']) && isset($change['meta_key'])) {
                    $pid = intval($change['resolved_post_id']);
                    update_post_meta($pid, $change['meta_key'], $change['previous_value']);
                    delete_post_meta($pid, '_elementor_css');
                    delete_post_meta($pid, '_elementor_page_assets');
                    return ['type' => 'post_meta_update', 'target' => $change['target'], 'reverted' => true];
                }
                return ['type' => 'post_meta_update', 'reverted' => false, 'note' => 'Missing previous_value, resolved_post_id, or meta_key'];

            case 'post_content_patch':
                if (isset($change['search']) && isset($change['replace']) && isset($change['resolved_post_id'])) {
                    $pid = intval($change['resolved_post_id']);
                    // Reverse in _elementor_data
                    $el_data = get_post_meta($pid, '_elementor_data', true);
                    if ($el_data) {
                        $new_el_data = str_replace($change['replace'], $change['search'], $el_data);
                        update_post_meta($pid, '_elementor_data', $new_el_data);
                    }
                    // Reverse in post_content
                    $post = get_post($pid);
                    if ($post) {
                        $new_content = str_replace($change['replace'], $change['search'], $post->post_content);
                        wp_update_post(['ID' => $pid, 'post_content' => $new_content]);
                    }
                    delete_post_meta($pid, '_elementor_css');
                    delete_post_meta($pid, '_elementor_page_assets');
                    return ['type' => 'post_content_patch', 'target' => $change['target'], 'reverted' => true];
                }
                return ['type' => 'post_content_patch', 'reverted' => false, 'note' => 'Missing search, replace, or resolved_post_id'];

            case 'woocommerce_product_update':
                if (function_exists('wc_get_product') && isset($change['results'])) {
                    foreach ($change['results'] as $result) {
                        if (!empty($result['updated']) && isset($result['id'])) {
                            $product = wc_get_product(intval($result['id']));
                            if ($product) {
                                $product->set_sale_price($result['old_sale_price'] ?? '');
                                $product->set_date_on_sale_from('');
                                $product->set_date_on_sale_to('');
                                $product->save();
                            }
                        }
                    }
                    return ['type' => 'woocommerce_product_update', 'reverted' => true];
                }
                return ['type' => 'woocommerce_product_update', 'reverted' => false, 'note' => 'WooCommerce not active — manual rollback required'];

            default:
                return ['type' => $type, 'reverted' => false, 'note' => 'Manual rollback required'];
        }
    }
}