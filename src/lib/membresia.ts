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
