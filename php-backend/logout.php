<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';

handlePreflight();
requireMethod('POST');

destroySession();
sendJson(['ok' => true]);
