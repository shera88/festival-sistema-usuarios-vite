<?php
declare(strict_types=1);

// Promo pre-festival de las membresías de video.
// Mientras devuelva true, TODOS pagan el precio de OFERTA (reserva) —hayan
// reservado o no en el kárdex— tanto en el precio mostrado (videos.php) como en
// el producto cobrado (membresia-checkout.php).
//
// AL INICIAR EL FESTIVAL: poner false y redeployar los 3 archivos:
//   _lib/promo.php, videos.php, membresia-checkout.php
function promoMembresiaTodos(): bool
{
    return true;
}
