// Precios de la Membresía de Videos 2026 (en Bs).
//
// La membresía da acceso a los videos del festival 2026 desde la pestaña Videos
// del portal de usuarios. El cobro NO va junto al pago de la credencial: se paga
// aparte por el checkout de WooCommerce al desbloquear los videos.
//
// - RESERVA: la persona marca la membresía en el formulario de kárdex (antes del
//   festival) → precio promocional.
// - REGULAR: la compra después, directo desde la pestaña de Videos.
export const MEMBRESIA_VIDEOS = {
  /** Precio promocional si reservó la membresía en el kárdex (antes del festival). */
  precioReserva: 20,
  /** Precio regular si la compra después del festival. */
  precioRegular: 50,
} as const;

// Membresía "Paquete Completo" 2026 (en Bs).
// Da acceso a TODOS los videos del festival 2026 (no solo los de sus bailes).
// Mismo modelo que la de Videos: reserva en el kárdex (40) o compra después (80).
export const MEMBRESIA_PAQUETE: {
  precioReserva: number;
  precioRegular: number;
  precioOferta: number | null;
} = {
  /** Precio promocional/anticipado si reservó el Paquete en el kárdex. */
  precioReserva: 40,
  /** Precio regular si lo compra después. */
  precioRegular: 80,
  /**
   * OFERTA ESPECIAL, hasta que termine la premiación.
   *
   * Tiene que valer lo mismo que el `sale_price` del producto 18744 en
   * WooCommerce (hoy 70, con regular_price 80). Si se cambia uno sin el otro, la
   * pantalla dice un precio y el cobro es otro — y el que sale perdiendo es quien
   * compra.
   *
   * Para cerrar la oferta hay que hacer LAS DOS cosas: poner `null` acá y quitar
   * el sale_price en Woo. Quitarlo sólo en Woo haría que se cobre 80 mostrando 70.
   *
   * No aplica a quien reservó en el kárdex: esa persona ya paga 40, que es menos.
   */
  precioOferta: 70,
};
