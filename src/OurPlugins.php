<?php

namespace Crafium\OurPlugins;

defined( 'ABSPATH' ) || exit;

class OurPlugins {
    /**
     * Get plugin path from slug.
     *
     * @param string $slug Plugin slug.
     * @return string|false Plugin path or false if not found.
     */
    protected static function get_plugin_path( string $slug ) {
        if ( ! function_exists( 'get_plugins' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        
        $plugins = get_plugins();
        foreach ( $plugins as $plugin_path => $plugin_data ) {
            $path_parts = explode( '/', $plugin_path );
            if ( $path_parts[0] === $slug ) {
                return $plugin_path;
            }
        }
        return false;
    }

    /**
     * Check if plugin is installed.
     *
     * @param string $slug Plugin slug.
     * @return bool True if installed, false otherwise.
     */
    protected static function is_plugin_installed( string $slug ): bool {
        return self::get_plugin_path( $slug ) !== false;
    }

    /**
     * Check if plugin is activated.
     *
     * @param string $slug Plugin slug.
     * @return bool True if activated, false otherwise.
     */
    protected static function is_plugin_activated( string $slug ): bool {
        if ( ! function_exists( 'is_plugin_active' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        
        $plugin_path = self::get_plugin_path( $slug );
        if ( ! $plugin_path ) {
            return false;
        }
        
        return is_plugin_active( $plugin_path );
    }

    /**
     * Enrich plugin data with installation and activation status.
     *
     * @param array $plugin_data Plugin data array with at least 'slug' key.
     * @return array Plugin data with added 'installed', 'activated' keys.
     */
    protected static function enrich_plugin_data( array $plugin_data ): array {
        if ( ! isset( $plugin_data['slug'] ) ) {
            return $plugin_data;
        }

        $slug        = $plugin_data['slug'];
        $installed   = self::is_plugin_installed( $slug );
        $activated   = $installed && self::is_plugin_activated( $slug );
        $activateUrl = '';
        if ( $installed && ! $activated ) {
            $args        = [
                'action'   => 'activate',
                'plugin'   => $slug . '/' . $slug . '.php',
                '_wpnonce' => wp_create_nonce( 'activate-plugin_' . $slug . '/' . $slug . '.php' ),
            ];
            $activateUrl = add_query_arg( $args, self_admin_url( 'plugins.php' ) );
        }

        return array_merge(
            $plugin_data,
            [
                'installed'   => $installed,
                'activated'   => $activated,
                'activateUrl' => $activateUrl,
            ]
        );
    }

    /**
     * Enrich multiple plugins data with installation and activation status.
     *
     * @param array $plugins_data Array of plugin data arrays.
     * @return array Array of enriched plugin data.
     */
    public static function enrich_plugins_data( string $current_plugin_slug ): array {
        return array_map(
            [ self::class, 'enrich_plugin_data' ],
            self::get_plugins_data( $current_plugin_slug )
        );
    }

    protected static function get_plugins_data( string $current_plugin_slug ): array {
        $cache_key   = $current_plugin_slug . '_plugins_data';
        $cached_data = get_transient( $cache_key );

        if ( $cached_data !== false ) {
            return $cached_data;
        }

        $response = wp_remote_get( 'https://raw.githubusercontent.com/crafium/our-plugins/refs/heads/master/plugins.json' );

        if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
            return [];
        }

        $response_data = json_decode( wp_remote_retrieve_body( $response ), true );

        if ( ! is_array( $response_data ) ) {
            return [];
        }

        $plugins_data = [];

        foreach ( $response_data as $plugin ) {
            if ( $plugin['slug'] === $current_plugin_slug ) {
                continue;
            }
            $plugins_data[] = [
                'name'        => sanitize_text_field( $plugin['name'] ),
                'slug'        => sanitize_text_field( $plugin['slug'] ),
                'description' => sanitize_text_field( $plugin['description'] ),
                'logoURL'     => sanitize_text_field( $plugin['logoURL'] ),
                'docsURL'     => sanitize_text_field( $plugin['docsURL'] ),
            ];
        }

        set_transient( $cache_key, $plugins_data, DAY_IN_SECONDS );

        return $plugins_data;
    }
}

