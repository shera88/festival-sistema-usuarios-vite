<?php
/**
 * Plugin Name: Festival — checkout membresías (ocultar aviso "pedido de invitado")
 * Description: En la página de pago (order-pay) de las membresías del festival
 *   (Videos / Paquete Completo), quita el aviso de WooCommerce
 *   "Estás pagando por un pedido de invitado…". El link de pago es
 *   intencionalmente compartible: el metadato _id_kardex habilita la membresía en
 *   la cuenta CORRECTA sin importar quién pague, así que ese aviso sobra y confunde.
 *   Alcance: SOLO órdenes con meta _membresia_paquete / _membresia_videos. El resto
 *   del checkout (entradas/boletos, etc.) conserva el aviso normal.
 * Author: Danzarte
 * Version: 1.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * El link de pago de una membresía es intencionalmente COMPARTIBLE: cualquiera
 * puede pagarlo y el metadato _id_kardex habilita la membresía en la cuenta
 * correcta. Por eso, para esas órdenes, desactivamos la verificación de email que
 * WooCommerce exige a órdenes de invitado pasado el período de gracia (~10 min);
 * si no, el link deja de funcionar al rato de creado. Sólo aplica a membresías.
 */
add_filter('woocommerce_order_email_verification_required', function ($required, $order, $context = '') {
    if ($order instanceof WC_Order
        && ($order->get_meta('_membresia_paquete') || $order->get_meta('_membresia_videos'))) {
        return false;
    }
    return $required;
}, 10, 3);

add_action('template_redirect', function () {
    // Sólo en la página de pago de una orden, y sólo si WooCommerce está activo.
    if (!function_exists('is_wc_endpoint_url') || !is_wc_endpoint_url('order-pay')) {
        return;
    }
    if (!function_exists('wc_get_order')) {
        return;
    }

    global $wp;
    $order_id = isset($wp->query_vars['order-pay']) ? absint($wp->query_vars['order-pay']) : 0;
    if (!$order_id) {
        return;
    }

    $order = wc_get_order($order_id);
    if (!$order) {
        return;
    }

    // Sólo actúa sobre órdenes de membresía del festival.
    $es_membresia = $order->get_meta('_membresia_paquete') || $order->get_meta('_membresia_videos');
    if (!$es_membresia) {
        return;
    }

    // 1) Blanquea el mensaje concreto (robusto a variantes de redacción EN de WooCommerce).
    add_filter('gettext', function ($translated, $text, $domain) {
        if ($domain === 'woocommerce'
            && stripos($text, 'guest order') !== false
            && stripos($text, 'recogni') !== false) {
            return '';
        }
        return $translated;
    }, 10, 3);

    // 2) Esconde el contenedor de aviso si quedó vacío (queda como caja vacía tras blanquear).
    add_action('wp_head', function () {
        echo '<style id="danzarte-hide-guest-notice">'
           . '.woocommerce-info:empty,.woocommerce-error:empty,.woocommerce-message:empty{display:none!important}'
           . '</style>';
    });
});
