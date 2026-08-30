<?php
/**
 * Plugin Name: Festival — membresía de CLIENTES (retorno al portal + correo de gracias)
 * Description: Para las órdenes de membresía compradas por el PÚBLICO GENERAL desde
 *   el área de clientes del portal (meta _origen = 'cliente'), hace dos cosas:
 *   (1) al terminar el pago devuelve a la persona al portal en vez de dejarla en la
 *   página de "pedido recibido" de WooCommerce, y (2) le manda un correo de
 *   agradecimiento con la gráfica del festival y un botón para entrar a ver los
 *   videos. Alcance: SOLO esas órdenes; entradas, boletos y las membresías de
 *   participantes siguen igual que siempre.
 * Author: Danzarte
 * Version: 1.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/** A dónde vuelve el comprador y a dónde apunta el botón del correo. */
const FDZ_CLIENTES_PORTAL_URL = 'https://festivaldanzarte.com/portal/clientes/videos';
const FDZ_CLIENTES_LOGO_URL   = 'https://supabase.imaginarte.cloud/storage/v1/object/public/uploads-2026/templates/logo-danzarte.png';

/** ¿Es una orden del área de clientes? */
function fdz_es_orden_cliente($order): bool
{
    return $order instanceof WC_Order && $order->get_meta('_origen') === 'cliente';
}

/**
 * (1) Volver al portal al terminar de pagar.
 *
 * Sin esto el comprador queda en la página de WooCommerce, que no tiene ninguna
 * puerta de vuelta al portal: acaba de pagar y no sabe cómo ver lo que compró.
 */
add_filter('woocommerce_get_return_url', function ($url, $order) {
    if (!fdz_es_orden_cliente($order)) {
        return $url;
    }
    // `pago=ok` le sirve a la app para saber que viene de pagar y volver a
    // preguntar por la membresía: quien la marca es n8n, unos segundos después.
    return add_query_arg('pago', 'ok', FDZ_CLIENTES_PORTAL_URL);
}, 10, 2);

/**
 * (2) Correo de agradecimiento.
 *
 * Va enganchado al cambio de estado a `processing` o `completed`, que es cuando
 * WooCommerce da la orden por cobrada — el mismo momento en que se dispara el
 * webhook que acredita la membresía.
 *
 * Se marca la orden con un meta al enviarlo: un pedido puede pasar por
 * `processing` y después por `completed`, y nadie quiere el mismo correo dos
 * veces.
 */
function fdz_enviar_gracias_cliente($order_id): void
{
    $order = wc_get_order($order_id);
    if (!fdz_es_orden_cliente($order)) {
        return;
    }
    if ($order->get_meta('_gracias_enviado')) {
        return;
    }

    $email = $order->get_billing_email();
    if (!$email) {
        return;
    }
    $nombre = trim((string)$order->get_billing_first_name());
    $saludo = $nombre !== '' ? 'Hola ' . esc_html($nombre) . ',' : 'Hola,';

    $asunto = 'Gracias por su compra — Videos del XVIII Festival Danzarte 2026';

    // HTML deliberadamente simple y con estilos en línea: los clientes de correo
    // ignoran las hojas de estilo y muchos recortan lo que no entienden.
    $cuerpo = '
<div style="margin:0;padding:24px 12px;background:#0b0b16;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#14142a;border-radius:16px;overflow:hidden;">
    <div style="padding:28px 24px 8px;text-align:center;">
      <img src="' . esc_url(FDZ_CLIENTES_LOGO_URL) . '" alt="XVIII Festival Danzarte 2026"
           width="200" style="max-width:200px;height:auto;display:inline-block;">
    </div>
    <div style="padding:8px 28px 28px;color:#e8e8f0;">
      <h1 style="margin:16px 0 8px;font-size:20px;color:#ffffff;">¡Gracias por su compra!</h1>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#c9c9d8;">
        ' . $saludo . ' su membresía de videos del <strong>XVIII Festival Danzarte 2026</strong>
        ya está activa. Puede ver todas las presentaciones del festival cuando quiera,
        desde cualquier dispositivo.
      </p>
      <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#c9c9d8;">
        Entre con el correo y la contraseña que eligió al crear su cuenta.
      </p>
      <p style="margin:0 0 24px;text-align:center;">
        <a href="' . esc_url(FDZ_CLIENTES_PORTAL_URL) . '"
           style="display:inline-block;padding:14px 32px;border-radius:10px;
                  background:linear-gradient(135deg,#22d3ee,#e879f9);color:#ffffff;
                  font-size:14px;font-weight:bold;text-decoration:none;letter-spacing:0.5px;">
          VER LOS VIDEOS
        </a>
      </p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:#8a8aa0;text-align:center;">
        Si el botón no funciona, copie este enlace en su navegador:<br>
        <span style="color:#22d3ee;">' . esc_html(FDZ_CLIENTES_PORTAL_URL) . '</span>
      </p>
    </div>
    <div style="padding:14px;background:#0f0f20;text-align:center;font-size:11px;color:#6f6f88;">
      XVIII Festival Danzarte 2026 · Orden #' . esc_html((string)$order->get_order_number()) . '
    </div>
  </div>
</div>';

    $enviado = wp_mail(
        $email,
        $asunto,
        $cuerpo,
        ['Content-Type: text/html; charset=UTF-8']
    );

    if ($enviado) {
        $order->update_meta_data('_gracias_enviado', gmdate('c'));
        $order->save();
    } else {
        // Que quede rastro: si el correo no sale, el comprador igual tiene la
        // membresía, pero nadie se entera de que no le llegó el aviso.
        $order->add_order_note('No se pudo enviar el correo de agradecimiento de la membresía.');
    }
}

add_action('woocommerce_order_status_processing', 'fdz_enviar_gracias_cliente', 20, 1);
add_action('woocommerce_order_status_completed', 'fdz_enviar_gracias_cliente', 20, 1);
