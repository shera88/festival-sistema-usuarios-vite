<?php
declare(strict_types=1);

// Promo pre-festival de las membresías de video.
// Mientras devuelva true, TODOS pagan el precio de OFERTA (reserva) —hayan
// reservado o no en el kárdex— tanto en el precio mostrado (videos.php) como en
// el producto cobrado (membresia-checkout.php).
//
// CERRADA el 2026-08-10 (festival terminado). Desde ahora:
//   · reservó en el kárdex  → sigue pagando 20 Bs (videos) / 40 Bs (paquete)
//   · no reservó            → precio completo 50 Bs / 80 Bs
// Para reabrirla: poner true y redeployar los 3 archivos:
//   _lib/promo.php, videos.php, membresia-checkout.php
function promoMembresiaTodos(): bool
{
    return false;
}
